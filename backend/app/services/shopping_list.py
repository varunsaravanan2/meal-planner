from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from uuid import UUID
from typing import List
from collections import defaultdict

from app.models.inventory import Inventory
from app.crud.meal_plan import get_meal_plans_for_range
from app.schemas.shopping_list import ShoppingListItem, ShoppingListResponse

# ---------------------------------------------------------------------------
# Unit normalization
# ---------------------------------------------------------------------------

_UNIT_ALIASES: dict[str, str] = {
    "gram": "g", "grams": "g",
    "kilogram": "kg", "kilograms": "kg",
    "milliliter": "ml", "milliliters": "ml", "millilitre": "ml", "millilitres": "ml",
    "liter": "l", "liters": "l", "litre": "l", "litres": "l",
    "tablespoon": "tbsp", "tablespoons": "tbsp",
    "teaspoon": "tsp", "teaspoons": "tsp",
    "cup": "cup", "cups": "cup",
    "ounce": "oz", "ounces": "oz",
    "pound": "lb", "pounds": "lb", "lbs": "lb",
    "piece": "whole", "pieces": "whole", "pcs": "whole", "pc": "whole",
    "clove": "clove", "cloves": "clove",
    "slice": "slice", "slices": "slice",
    "pinch": "pinch", "pinches": "pinch",
}


def _normalize_unit(unit: str) -> str:
    return _UNIT_ALIASES.get(unit.strip().lower(), unit.strip().lower())


# ---------------------------------------------------------------------------
# Quantity parsing  (handles "2", "1.5", "1/2", "2 1/2")
# ---------------------------------------------------------------------------

def _parse_quantity(raw: str) -> float:
    if not raw or not raw.strip():
        return 1.0
    raw = raw.strip()
    try:
        # "2 1/2" style mixed number
        if " " in raw:
            parts = raw.split()
            whole = float(parts[0])
            frac_parts = parts[1].split("/")
            frac = float(frac_parts[0]) / float(frac_parts[1])
            return whole + frac
        # "1/2" style fraction
        if "/" in raw:
            parts = raw.split("/")
            return float(parts[0]) / float(parts[1])
        return float(raw)
    except (ValueError, ZeroDivisionError, IndexError):
        return 1.0


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def generate_shopping_list(
    db: Session,
    user_id: UUID,
    start_date: date,
    end_date: date,
) -> ShoppingListResponse:
    meal_plans = get_meal_plans_for_range(db, user_id, start_date, end_date)

    # Aggregate: (normalized_name, normalized_unit) → {qty, titles}
    # Using a dict so we can merge same ingredient from multiple recipes
    aggregated: dict[tuple[str, str], dict] = defaultdict(lambda: {"quantity": 0.0, "titles": set()})

    for plan in meal_plans:
        recipe = plan.recipe
        if not recipe or not recipe.ingredients:
            continue

        # Compute servings scale factor
        scale = 1.0
        if plan.servings and recipe.servings and recipe.servings > 0:
            scale = plan.servings / recipe.servings

        for ing in recipe.ingredients:
            name = ing.get("name", "").strip().lower()
            if not name:
                continue
            qty = _parse_quantity(str(ing.get("quantity", "1"))) * scale
            unit = _normalize_unit(ing.get("unit", ""))
            key = (name, unit)
            aggregated[key]["quantity"] += qty
            aggregated[key]["titles"].add(recipe.title)

    # Load the user's inventory for a quick lookup: name → quantity on hand
    inventory_items = db.query(Inventory).filter(Inventory.user_id == user_id).all()
    inventory_map: dict[str, float] = {
        item.item_name.strip().lower(): item.quantity
        for item in inventory_items
    }

    items_to_buy: List[ShoppingListItem] = []
    already_have: List[ShoppingListItem] = []

    for (name, unit), data in sorted(aggregated.items()):
        needed = round(data["quantity"], 2)
        on_hand = inventory_map.get(name, 0.0)
        to_buy = max(0.0, needed - on_hand)

        item = ShoppingListItem(
            ingredient=name,
            quantity_needed=needed,
            unit=unit,
            have_in_inventory=round(on_hand, 2),
            to_buy=round(to_buy, 2),
            used_in=sorted(data["titles"]),
        )

        if to_buy > 0:
            items_to_buy.append(item)
        else:
            already_have.append(item)

    return ShoppingListResponse(
        start_date=start_date,
        end_date=end_date,
        total_items=len(items_to_buy),
        items_to_buy=items_to_buy,
        already_have=already_have,
    )
