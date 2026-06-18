from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.models.workout_template import WorkoutTemplate


def list_templates(db: Session, user_id: UUID) -> List[WorkoutTemplate]:
    return (
        db.query(WorkoutTemplate)
        .filter(WorkoutTemplate.user_id == user_id)
        .order_by(WorkoutTemplate.created_at.desc())
        .all()
    )


def get_template(db: Session, template_id: str, user_id: UUID) -> WorkoutTemplate | None:
    return db.query(WorkoutTemplate).filter(
        WorkoutTemplate.id == template_id,
        WorkoutTemplate.user_id == user_id,
    ).first()


def create_template(db: Session, user_id: UUID, data: dict) -> WorkoutTemplate:
    entry = WorkoutTemplate(user_id=user_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_template(db: Session, entry: WorkoutTemplate) -> None:
    db.delete(entry)
    db.commit()
