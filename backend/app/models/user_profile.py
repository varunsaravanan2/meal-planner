from uuid import uuid4
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer
from sqlalchemy.dialects.postgresql import UUID, JSON
from app.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    
    age = Column(Integer)
    sex = Column(String)
    height_ft = Column(Integer)
    height_in = Column(Integer)
    weight_lbs = Column(Float)
    target_weight_lbs = Column(Float)
    primary_goal = Column(String)
    timeline = Column(String, nullable=True)
    activity_level = Column(String)
    fitness_level = Column(String)
    workouts_per_week = Column(Integer)
    equipment = Column(JSON)
    workout_types = Column(JSON)
    injuries = Column(Text, nullable=True)

    diet_type = Column(String)
    allergies = Column(JSON)
    cuisine_preferences = Column(JSON)
    disliked_foods = Column(Text, nullable=True)

    cooking_skill = Column(String)
    max_cook_time = Column(String)
    weekly_budget = Column(Float, nullable=True)

    calorie_goal = Column(Integer, nullable=True)
    protein_goal_g = Column(Integer, nullable=True)
    carbs_goal_g = Column(Integer, nullable=True)
    fat_goal_g = Column(Integer, nullable=True)
    water_goal = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
