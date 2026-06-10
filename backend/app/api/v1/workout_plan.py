from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.crud.workout_plan import get_workouts_for_week

router = APIRouter(tags=["workouts"])

@router.get("")
def get_workouts(
    start_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    workouts = get_workouts_for_week(db, current_user.id, start_date)
    result = {}
    for w in workouts:
        result[str(w.planned_date)] = {
            "id": str(w.id),
            "is_rest_day": w.is_rest_day,
            "workout_type": w.workout_type,
            "title": w.title,
            "duration_minutes": w.duration_minutes,
            "exercises": w.exercises,
            "notes": w.notes,
        }
    return {"workouts": result}
