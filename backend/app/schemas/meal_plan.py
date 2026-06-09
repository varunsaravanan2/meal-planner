from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
from uuid import UUID
from typing import Optional, List

from app.schemas.recipe import RecipeResponse

MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"]


class MealPlanCreate(BaseModel):
    recipe_id: UUID
    planned_date: date
    meal_slot: str = Field(..., examples=["breakfast", "lunch", "dinner", "snack"])
    servings: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None


class MealPlanUpdate(BaseModel):
    planned_date: Optional[date] = None
    meal_slot: Optional[str] = None
    servings: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None


class MealPlanResponse(BaseModel):
    id: UUID
    user_id: UUID
    recipe_id: UUID
    planned_date: date
    meal_slot: str
    servings: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    recipe: Optional[RecipeResponse] = None

    model_config = ConfigDict(from_attributes=True)


class WeeklyPlanResponse(BaseModel):
    week_start: date
    week_end: date
    days: dict  # date string → list of MealPlanResponse
