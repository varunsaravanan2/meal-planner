from sqlalchemy.orm import Session
from uuid import UUID
from app.models.user_profile import UserProfile
from app.schemas.user_profile import UserProfileCreate, UserProfileUpdate

def get_profile(db: Session, user_id: UUID):
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

def create_profile(db: Session, user_id: UUID, profile_data: UserProfileCreate):
    profile = UserProfile(user_id=user_id, **profile_data.model_dump(exclude_none=True))
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

def upsert_profile(db: Session, user_id: UUID, data: UserProfileUpdate):
    profile = get_profile(db, user_id)
    if not profile: 
        return create_profile(db, user_id, data)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile