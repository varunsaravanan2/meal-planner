from uuid import uuid4
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    workout_type = Column(String, nullable=True)   # strength, cardio, hiit, yoga, running, etc.
    duration_minutes = Column(Integer, nullable=True)
    exercises = Column(JSON, nullable=True)          # [{name, sets, reps, notes}]
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
