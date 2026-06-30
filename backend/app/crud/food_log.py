from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date
from app.models.food_log import FoodLog
from app.schemas.food_log import FoodLogCreate


def get_food_log_for_range(db: Session, user_id: UUID, start: date, end: date):
    return db.query(FoodLog).filter(
        FoodLog.user_id == user_id,
        FoodLog.log_date >= start,
        FoodLog.log_date <= end,
    ).order_by(FoodLog.log_date, FoodLog.created_at).all()


def get_food_log_for_date(db: Session, user_id: UUID, log_date: date):
    return db.query(FoodLog).filter(
        FoodLog.user_id == user_id,
        FoodLog.log_date == log_date,
    ).order_by(FoodLog.created_at).all()


def create_food_log_entry(db: Session, user_id: UUID, data: FoodLogCreate) -> FoodLog:
    entry = FoodLog(user_id=user_id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_food_log_entry(db: Session, entry_id: UUID, user_id: UUID) -> bool:
    entry = db.query(FoodLog).filter(
        FoodLog.id == entry_id,
        FoodLog.user_id == user_id,
    ).first()
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True
