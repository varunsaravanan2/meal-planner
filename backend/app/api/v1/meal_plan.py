from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date, timedelta
from typing import List

from app.database import get_db
from app.schemas.meal_plan import MealPlanCreate, MealPlanUpdate, MealPlanResponse, WeeklyPlanResponse, MEAL_SLOTS
from app.crud.meal_plan import (
    get_meal_plan_by_id,
    get_meal_plans_for_range,
    create_meal_plan,
    update_meal_plan,
    delete_meal_plan,
    get_week_range,
)
from app.crud.recipe import get_recipe_by_id, get_user_recipes
from app.api.v1.auth import get_current_user_dependency
from app.models.user import User

router = APIRouter()


@router.get("/week", response_model=WeeklyPlanResponse, summary="Get weekly meal plan")
def get_weekly_plan(
    week_of: date = Query(default=None, description="Any date within the desired week (defaults to current week)"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get the full meal plan for a week, grouped by day.

    Returns a dict keyed by ISO date string (YYYY-MM-DD), each containing
    a list of meal plan entries sorted by meal slot.
    """
    reference = week_of or date.today()
    start, end = get_week_range(reference)

    entries = get_meal_plans_for_range(db, current_user.id, start, end)

    days: dict = {}
    for entry in entries:
        key = entry.planned_date.isoformat()
        if key not in days:
            days[key] = []
        days[key].append(MealPlanResponse.model_validate(entry))

    return WeeklyPlanResponse(week_start=start, week_end=end, days=days)


@router.get("/range", response_model=List[MealPlanResponse], summary="Get meal plans for a date range")
def get_plans_for_range(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be >= start_date")
    if (end_date - start_date).days > 90:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Range cannot exceed 90 days")

    entries = get_meal_plans_for_range(db, current_user.id, start_date, end_date)
    return entries


@router.post("/", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED, summary="Add a meal to the plan")
def add_meal_plan(
    plan: MealPlanCreate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Schedule a recipe for a specific date and meal slot.

    meal_slot must be one of: breakfast, lunch, dinner, snack.
    """
    if plan.meal_slot not in MEAL_SLOTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"meal_slot must be one of: {', '.join(MEAL_SLOTS)}"
        )

    recipe = get_recipe_by_id(db, plan.recipe_id, current_user.id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    entry = create_meal_plan(
        db=db,
        user_id=current_user.id,
        recipe_id=plan.recipe_id,
        planned_date=plan.planned_date,
        meal_slot=plan.meal_slot,
        servings=plan.servings,
        notes=plan.notes
    )
    return entry


@router.get("/{plan_id}", response_model=MealPlanResponse, summary="Get a single meal plan entry")
def get_meal_plan(
    plan_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    entry = get_meal_plan_by_id(db, plan_id, current_user.id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal plan entry not found")
    return entry


@router.put("/{plan_id}", response_model=MealPlanResponse, summary="Update a meal plan entry")
def update_meal_plan_endpoint(
    plan_id: UUID,
    plan_update: MealPlanUpdate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    update_data = plan_update.model_dump(exclude_unset=True)

    if "meal_slot" in update_data and update_data["meal_slot"] not in MEAL_SLOTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"meal_slot must be one of: {', '.join(MEAL_SLOTS)}"
        )

    entry = update_meal_plan(db, plan_id, current_user.id, update_data)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal plan entry not found")
    return entry


@router.post("/{plan_id}/swap", response_model=MealPlanResponse, summary="Swap meal for another recipe")
def swap_meal_endpoint(
    plan_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    import random
    entry = get_meal_plan_by_id(db, plan_id, current_user.id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal plan entry not found")

    slot = entry.meal_slot
    # Prefer recipes matching the same category as the slot
    candidates = [r for r in get_user_recipes(db, current_user.id, limit=200, category=slot) if r.id != entry.recipe_id]
    if not candidates:
        candidates = [r for r in get_user_recipes(db, current_user.id, limit=200) if r.id != entry.recipe_id]
    if not candidates:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No other recipes available to swap to")

    new_recipe = random.choice(candidates)
    updated = update_meal_plan(db, plan_id, current_user.id, {"recipe_id": new_recipe.id})
    return updated


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a meal plan entry")
def delete_meal_plan_endpoint(
    plan_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    if not delete_meal_plan(db, plan_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal plan entry not found")
    return None
