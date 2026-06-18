from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.crud.workout_template import list_templates, get_template, create_template, delete_template
from app.crud.workout_plan import create_workout, get_workouts_for_week
from app.models.workout_plan import WorkoutPlan

router = APIRouter(tags=["workout-templates"])


class ExerciseIn(BaseModel):
    name: str
    sets: Optional[int] = None
    reps: Optional[str] = None
    notes: Optional[str] = None


class WorkoutTemplateIn(BaseModel):
    title: str
    workout_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    exercises: Optional[List[ExerciseIn]] = None
    notes: Optional[str] = None


class ScheduleIn(BaseModel):
    planned_date: date


def _serialize(t) -> dict:
    return {
        "id": str(t.id),
        "title": t.title,
        "workout_type": t.workout_type,
        "duration_minutes": t.duration_minutes,
        "exercises": t.exercises,
        "notes": t.notes,
        "created_at": t.created_at.isoformat(),
    }


@router.get("")
def get_templates(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return [_serialize(t) for t in list_templates(db, current_user.id)]


@router.post("")
def add_template(
    body: WorkoutTemplateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    exercises_data = [e.model_dump() for e in body.exercises] if body.exercises else None
    data = {
        "title": body.title,
        "workout_type": body.workout_type,
        "duration_minutes": body.duration_minutes,
        "exercises": exercises_data,
        "notes": body.notes,
    }
    return _serialize(create_template(db, current_user.id, data))


@router.delete("/{template_id}")
def remove_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = get_template(db, template_id, current_user.id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found.")
    delete_template(db, t)
    return {"deleted": True}


@router.post("/{template_id}/schedule")
def schedule_template(
    template_id: str,
    body: ScheduleIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = get_template(db, template_id, current_user.id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found.")

    # Replace any existing workout on that date
    existing = db.query(WorkoutPlan).filter(
        WorkoutPlan.user_id == current_user.id,
        WorkoutPlan.planned_date == body.planned_date,
    ).first()
    if existing:
        existing.title = t.title
        existing.workout_type = t.workout_type
        existing.duration_minutes = t.duration_minutes
        existing.exercises = t.exercises
        existing.notes = t.notes
        existing.is_rest_day = False
        db.commit()
        db.refresh(existing)
        return {"scheduled": True, "date": body.planned_date.isoformat()}

    create_workout(db, current_user.id, {
        "planned_date": body.planned_date,
        "is_rest_day": False,
        "workout_type": t.workout_type,
        "title": t.title,
        "duration_minutes": t.duration_minutes,
        "exercises": t.exercises,
        "notes": t.notes,
    })
    return {"scheduled": True, "date": body.planned_date.isoformat()}
