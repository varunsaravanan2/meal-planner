from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base

PLAN_LIMITS = {
    "free":    {"generations": 1,  "days": None},
    "week":    {"generations": 3,  "days": 7},
    "month":   {"generations": 10, "days": 30},
    "3month":  {"generations": 30, "days": 90},
}

PLAN_PRICES = {
    "week":   {"amount": 499,   "label": "1 Week",   "currency": "usd"},
    "month":  {"amount": 1299,  "label": "1 Month",  "currency": "usd"},
    "3month": {"amount": 2999,  "label": "3 Months", "currency": "usd"},
}


class Subscription(Base):
    __tablename__ = "subscriptions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    plan_type        = Column(String, nullable=False, default="free")   # free | week | month | 3month
    status           = Column(String, nullable=False, default="active") # active | expired
    stripe_session_id = Column(String, nullable=True)
    generations_used = Column(Integer, nullable=False, default=0)
    generations_limit = Column(Integer, nullable=False, default=1)
    starts_at        = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at       = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="subscriptions")
