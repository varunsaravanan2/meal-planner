from uuid import uuid4
from datetime import datetime, date
from sqlalchemy import Column, String, Float, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    recipe_id = Column(UUID(as_uuid=True), ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)

    log_date = Column(Date, nullable=False, index=True, default=date.today)
    meal_slot = Column(String, nullable=False)

    name = Column(String, nullable=False)
    calories = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    servings = Column(Float, default=1.0)

    created_at = Column(DateTime, default=datetime.utcnow)

    recipe = relationship("Recipe", foreign_keys=[recipe_id])
