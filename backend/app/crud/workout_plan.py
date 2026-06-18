from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date, timedelta
from typing import List
from app.models.workout_plan import WorkoutPlan

def get_workouts_for_week(db: Session, user_id: UUID, monday: date) -> List[WorkoutPlan]:
    sunday = monday + timedelta(days=6)
    return db.query(WorkoutPlan).filter(
        WorkoutPlan.user_id == user_id,
        WorkoutPlan.planned_date >= monday,
        WorkoutPlan.planned_date <= sunday,
    ).order_by(WorkoutPlan.planned_date).all()

def clear_week(db: Session, user_id: UUID, monday: date):
    sunday = monday + timedelta(days=6)
    db.query(WorkoutPlan).filter(
        WorkoutPlan.user_id == user_id,
        WorkoutPlan.planned_date >= monday,
        WorkoutPlan.planned_date <= sunday,
    ).delete()
    db.commit()

def create_workout(db: Session, user_id: UUID, data: dict) -> WorkoutPlan:
    entry = WorkoutPlan(user_id=user_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_workout(db: Session, entry: WorkoutPlan, data: dict) -> WorkoutPlan:
    for key, val in data.items():
        setattr(entry, key, val)
    db.commit()
    db.refresh(entry)
    return entry


def delete_workout(db: Session, entry: WorkoutPlan) -> None:
    db.delete(entry)
    db.commit()
