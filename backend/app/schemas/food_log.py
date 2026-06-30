from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, datetime


class FoodLogCreate(BaseModel):
    recipe_id: Optional[UUID] = None
    log_date: date
    meal_slot: str
    name: str
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    servings: float = 1.0


class FoodLogOut(BaseModel):
    id: UUID
    recipe_id: Optional[UUID] = None
    log_date: date
    meal_slot: str
    name: str
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    servings: float
    created_at: datetime

    model_config = {"from_attributes": True}
