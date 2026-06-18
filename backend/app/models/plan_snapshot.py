from sqlalchemy import Column, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base


class PlanSnapshot(Base):
    __tablename__ = "plan_snapshots"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    week_start  = Column(Date, nullable=False)
    snapshot    = Column(JSONB, nullable=False)   # full serialized week plan
    created_at  = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="plan_snapshots")
