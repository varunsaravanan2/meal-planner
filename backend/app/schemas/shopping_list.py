from pydantic import BaseModel
from datetime import date
from typing import List, Optional


class ShoppingListItem(BaseModel):
    ingredient: str
    quantity_needed: float
    unit: str
    have_in_inventory: float
    to_buy: float
    used_in: List[str]  # recipe titles that need this ingredient


class ShoppingListResponse(BaseModel):
    start_date: date
    end_date: date
    total_items: int           # total line items to buy
    items_to_buy: List[ShoppingListItem]
    already_have: List[ShoppingListItem]  # ingredients covered by inventory
