from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False, index=True)

    # Which day and meal slot this is planned for
    planned_date = Column(Date, nullable=False, index=True)
    meal_slot = Column(String, nullable=False)  # breakfast, lunch, dinner, snack

    servings = Column(Integer, nullable=True)   # override recipe default
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="meal_plans")
    recipe = relationship("Recipe")

    def __repr__(self):
        return f"<MealPlan(date='{self.planned_date}', slot='{self.meal_slot}')>"
