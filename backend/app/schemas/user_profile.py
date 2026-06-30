from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

class UserProfileBase(BaseModel):
    age: Optional[int] = None
    sex: Optional[str] = None
    height_ft: Optional[int] = None
    height_in: Optional[int] = None
    weight_lbs: Optional[float] = None
    target_weight_lbs: Optional[float] = None
    primary_goal: Optional[str] = None
    timeline: Optional[str] = None
    activity_level: Optional[str] = None
    fitness_level: Optional[str] = None
    workouts_per_week: Optional[int] = None
    equipment: Optional[List[str]] = None
    workout_types: Optional[List[str]] = None
    injuries: Optional[str] = None
    diet_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    cuisine_preferences: Optional[List[str]] = None
    disliked_foods: Optional[str] = None
    cooking_skill: Optional[str] = None
    max_cook_time: Optional[str] = None
    weekly_budget: Optional[float] = None
    calorie_goal: Optional[int] = None
    protein_goal_g: Optional[int] = None
    carbs_goal_g: Optional[int] = None
    fat_goal_g: Optional[int] = None
    water_goal: Optional[int] = None

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    pass

class UserProfileOut(UserProfileBase):
    id: UUID
    user_id: UUID

    model_config = {
        "from_attributes": True
    }
    