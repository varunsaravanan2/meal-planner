from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date
from uuid import UUID

from app.models.plan_snapshot import PlanSnapshot

MAX_SNAPSHOTS_PER_WEEK = 3


def save_snapshot(db: Session, user_id: UUID, week_start: date, snapshot_data: dict) -> PlanSnapshot:
    snap = PlanSnapshot(user_id=user_id, week_start=week_start, snapshot=snapshot_data)
    db.add(snap)
    db.commit()
    db.refresh(snap)

    # Keep only the last MAX_SNAPSHOTS per user per week
    old = (
        db.query(PlanSnapshot)
        .filter(PlanSnapshot.user_id == user_id, PlanSnapshot.week_start == week_start)
        .order_by(desc(PlanSnapshot.created_at))
        .offset(MAX_SNAPSHOTS_PER_WEEK)
        .all()
    )
    for o in old:
        db.delete(o)
    db.commit()
    return snap


def list_snapshots(db: Session, user_id: UUID, week_start: date) -> list[PlanSnapshot]:
    return (
        db.query(PlanSnapshot)
        .filter(PlanSnapshot.user_id == user_id, PlanSnapshot.week_start == week_start)
        .order_by(desc(PlanSnapshot.created_at))
        .all()
    )


def get_snapshot(db: Session, snapshot_id: str, user_id: UUID) -> PlanSnapshot | None:
    return db.query(PlanSnapshot).filter(
        PlanSnapshot.id == snapshot_id,
        PlanSnapshot.user_id == user_id,
    ).first()
