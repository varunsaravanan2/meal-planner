from sqlalchemy.orm import Session, joinedload
from app.models.meal_plan import MealPlan
from uuid import UUID
from datetime import date, timedelta
from typing import Optional, List


def get_meal_plan_by_id(db: Session, plan_id: UUID, user_id: UUID) -> Optional[MealPlan]:
    return db.query(MealPlan).options(joinedload(MealPlan.recipe)).filter(
        MealPlan.id == plan_id,
        MealPlan.user_id == user_id
    ).first()


def get_meal_plans_for_range(
    db: Session,
    user_id: UUID,
    start_date: date,
    end_date: date
) -> List[MealPlan]:
    return db.query(MealPlan).options(joinedload(MealPlan.recipe)).filter(
        MealPlan.user_id == user_id,
        MealPlan.planned_date >= start_date,
        MealPlan.planned_date <= end_date
    ).order_by(MealPlan.planned_date, MealPlan.meal_slot).all()


def create_meal_plan(
    db: Session,
    user_id: UUID,
    recipe_id: UUID,
    planned_date: date,
    meal_slot: str,
    servings: Optional[int] = None,
    notes: Optional[str] = None
) -> MealPlan:
    entry = MealPlan(
        user_id=user_id,
        recipe_id=recipe_id,
        planned_date=planned_date,
        meal_slot=meal_slot,
        servings=servings,
        notes=notes
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    # Reload with recipe joined
    db.refresh(entry)
    return get_meal_plan_by_id(db, entry.id, user_id)


def update_meal_plan(
    db: Session,
    plan_id: UUID,
    user_id: UUID,
    update_data: dict
) -> Optional[MealPlan]:
    entry = get_meal_plan_by_id(db, plan_id, user_id)
    if not entry:
        return None
    for key, value in update_data.items():
        if value is not None and hasattr(entry, key):
            setattr(entry, key, value)
    db.commit()
    return get_meal_plan_by_id(db, plan_id, user_id)


def delete_meal_plan(db: Session, plan_id: UUID, user_id: UUID) -> bool:
    entry = db.query(MealPlan).filter(
        MealPlan.id == plan_id,
        MealPlan.user_id == user_id
    ).first()
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def get_week_range(reference_date: date) -> tuple[date, date]:
    """Return the Monday–Sunday that contains reference_date."""
    start = reference_date - timedelta(days=reference_date.weekday())
    end = start + timedelta(days=6)
    return start, end
