from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.crud.plan_snapshot import list_snapshots, get_snapshot
from app.crud.meal_plan import create_meal_plan
from app.crud.recipe import create_recipe
from app.models.meal_plan import MealPlan

router = APIRouter(tags=["plan-snapshots"])


@router.get("")
def get_snapshots(week_start: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        monday = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid week_start date.")
    snaps = list_snapshots(db, current_user.id, monday)
    return [
        {"id": str(s.id), "week_start": s.week_start.isoformat(), "created_at": s.created_at.isoformat()}
        for s in snaps
    ]


@router.post("/{snapshot_id}/restore")
def restore_snapshot(snapshot_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    snap = get_snapshot(db, snapshot_id, current_user.id)
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found.")

    monday = snap.week_start
    sunday = date.fromordinal(monday.toordinal() + 6)

    # Clear current week
    db.query(MealPlan).filter(
        MealPlan.user_id == current_user.id,
        MealPlan.planned_date >= monday,
        MealPlan.planned_date <= sunday,
    ).delete()
    db.commit()

    # Restore from snapshot
    meals_restored = 0
    for day in snap.snapshot.get("days", []):
        planned_date = date.fromisoformat(day["date"])
        for meal in day.get("meals", []):
            recipe = create_recipe(
                db=db, user_id=current_user.id,
                title=meal["title"],
                description=meal.get("description"),
                ingredients=meal.get("ingredients", []),
                steps=meal.get("steps", []),
                prep_time=meal.get("prep_time"),
                cook_time=meal.get("cook_time"),
                servings=meal.get("servings", 1),
                nutrition=meal.get("nutrition", {}),
                category=meal.get("category"),
                cuisine=meal.get("cuisine"),
                source_url="ai-generated",
            )
            create_meal_plan(
                db=db, user_id=current_user.id, recipe_id=recipe.id,
                planned_date=planned_date, meal_slot=meal["slot"],
                servings=meal.get("servings", 1),
            )
            meals_restored += 1

    return {"meals_restored": meals_restored}
