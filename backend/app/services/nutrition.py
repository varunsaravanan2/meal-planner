import httpx
from typing import Optional

USDA_BASE = "https://api.nal.usda.gov/fdc/v1"

def lookup_ingredient(name: str, api_key: str) -> Optional[dict]:
    """Return per-100g nutrition for an ingredient from USDA FoodData Central."""
    try:
        with httpx.Client(timeout=8) as client:
            resp = client.get(
                f"{USDA_BASE}/foods/search",
                params={
                    "query": name,
                    "api_key": api_key,
                    "pageSize": 1,
                    "dataType": "Foundation,SR Legacy",
                }
            )
            data = resp.json()
            foods = data.get("foods", [])
            if not foods:
                return None
            food = foods[0]
            nutrients = {n["nutrientName"]: n.get("value", 0) for n in food.get("foodNutrients", [])}
            return {
                "fdc_id": food.get("fdcId"),
                "usda_name": food.get("description"),
                "calories_per_100g": nutrients.get("Energy", 0),
                "protein_g_per_100g": nutrients.get("Protein", 0),
                "carbs_g_per_100g": nutrients.get("Carbohydrate, by difference", 0),
                "fat_g_per_100g": nutrients.get("Total lipid (fat)", 0),
            }
    except Exception:
        return None
