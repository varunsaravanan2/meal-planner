from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.crud.workout_plan import get_workouts_for_week, create_workout, update_workout, delete_workout
from app.models.workout_plan import WorkoutPlan

router = APIRouter(tags=["workouts"])


class ExerciseIn(BaseModel):
    name: str
    sets: Optional[int] = None
    reps: Optional[str] = None
    notes: Optional[str] = None


class WorkoutIn(BaseModel):
    planned_date: date
    is_rest_day: bool = False
    workout_type: Optional[str] = None
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    exercises: Optional[List[ExerciseIn]] = None
    notes: Optional[str] = None


def _serialize(w: WorkoutPlan) -> dict:
    return {
        "id": str(w.id),
        "is_rest_day": w.is_rest_day,
        "workout_type": w.workout_type,
        "title": w.title,
        "duration_minutes": w.duration_minutes,
        "exercises": w.exercises,
        "notes": w.notes,
    }


@router.get("")
def get_workouts(
    start_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    workouts = get_workouts_for_week(db, current_user.id, start_date)
    result = {}
    for w in workouts:
        result[str(w.planned_date)] = _serialize(w)
    return {"workouts": result}


@router.post("")
def add_workout(
    body: WorkoutIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # If a workout already exists for this date, update it
    existing = db.query(WorkoutPlan).filter(
        WorkoutPlan.user_id == current_user.id,
        WorkoutPlan.planned_date == body.planned_date,
    ).first()

    exercises_data = [e.model_dump() for e in body.exercises] if body.exercises else None
    data = {
        "planned_date": body.planned_date,
        "is_rest_day": body.is_rest_day,
        "workout_type": body.workout_type,
        "title": body.title,
        "duration_minutes": body.duration_minutes,
        "exercises": exercises_data,
        "notes": body.notes,
    }

    if existing:
        w = update_workout(db, existing, data)
    else:
        w = create_workout(db, current_user.id, data)

    return _serialize(w)


@router.put("/{workout_id}")
def edit_workout(
    workout_id: str,
    body: WorkoutIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    w = db.query(WorkoutPlan).filter(
        WorkoutPlan.id == workout_id,
        WorkoutPlan.user_id == current_user.id,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found.")

    exercises_data = [e.model_dump() for e in body.exercises] if body.exercises else None
    data = {
        "planned_date": body.planned_date,
        "is_rest_day": body.is_rest_day,
        "workout_type": body.workout_type,
        "title": body.title,
        "duration_minutes": body.duration_minutes,
        "exercises": exercises_data,
        "notes": body.notes,
    }
    return _serialize(update_workout(db, w, data))


@router.delete("/{workout_id}")
def remove_workout(
    workout_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    w = db.query(WorkoutPlan).filter(
        WorkoutPlan.id == workout_id,
        WorkoutPlan.user_id == current_user.id,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found.")
    delete_workout(db, w)
    return {"deleted": True}
