from sqlalchemy import Column, String, ForeignKey, Date, Float, DateTime 
from sqlalchemy.dialects.postgresql import UUID
#from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class ProgressEntry(Base):
    __tablename__ = "progress_entries"

    id = Column(UUID(as_uuid=True), primary_key = True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable = False, index = True)
    week_date = Column(Date, nullable = False, index = True)
    weight_lbs = Column(Float, nullable = True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate = datetime.utcnow)

class ProgressPhoto(Base):
    __tablename__ = "progress_photos"

    id = Column(UUID(as_uuid=True), primary_key = True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    progress_entry_id = Column(UUID(as_uuid = True), ForeignKey("progress_entries.id"), nullable = False, index = True)
    s3_key = Column(String, nullable = False)
    url = Column(String, nullable = False)
    label = Column(String, nullable = True)
    created_at = Column(DateTime, default=datetime.utcnow)