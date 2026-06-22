from sqlalchemy.orm import Session
from app.models.progress import ProgressEntry, ProgressPhoto
from uuid import UUID
from typing import Optional, List
from datetime import date

def get_progress_entry_by_id(
        db: Session, 
        progress_entry_id: UUID, 
        user_id: UUID 
) -> Optional[ProgressEntry]:

    return db.query(ProgressEntry).filter(
        ProgressEntry.id == progress_entry_id,
        ProgressEntry.user_id == user_id
    ).first()

def get_progress_photo_by_id(
        db:Session,
        progress_photo_id: UUID,
        user_id: UUID,
) -> Optional[ProgressPhoto]:
    
    return db.query(ProgressPhoto).filter(
        ProgressPhoto.id == progress_photo_id,
        ProgressPhoto.user_id == user_id
    ).first()

def get_all_progress_entries(
        db: Session, 
        user_id: UUID
    ) -> List[ProgressEntry]:

    return db.query(ProgressEntry).filter(
        ProgressEntry.user_id == user_id
    ).order_by(ProgressEntry.week_date.desc()).all()

def get_all_photos_for_entry(
        db: Session,
        progress_entry_id: UUID,
        user_id: UUID
) -> List[ProgressPhoto]:
    return db.query(ProgressPhoto).filter(
        ProgressPhoto.progress_entry_id == progress_entry_id,
        ProgressPhoto.user_id == user_id
    ).all()


def create_user_progress_entry(
        db: Session,
        user_id: UUID,
        week_date: date,
        weight_lbs: Optional[float] = None
) -> ProgressEntry:
    
    db_progress_entry = ProgressEntry(
        user_id = user_id,
        week_date = week_date,
        weight_lbs = weight_lbs
    )

    db.add(db_progress_entry)
    db.commit()
    db.refresh(db_progress_entry)

    return db_progress_entry

def create_progress_photo(
        db: Session,
        user_id: UUID,
        progress_entry_id: UUID, 
        s3_key: str,
        url: str,
        label: Optional[str] = None
) -> ProgressPhoto:
    
    db_progress_photo = ProgressPhoto(
        user_id = user_id,
        progress_entry_id = progress_entry_id,
        s3_key = s3_key,
        url = url,
        label = label,
    )

    db.add(db_progress_photo)
    db.commit()
    db.refresh(db_progress_photo)

    return db_progress_photo

def update_progress_entry(
        db: Session,
        progress_entry_id: UUID,
        user_id: UUID,
        update_data: dict
) -> Optional[ProgressEntry]:
    
    progress_entry = get_progress_entry_by_id(db, progress_entry_id, user_id)

    if not progress_entry:
        return None
    
    for key, value in update_data.items():
        if value is not None and hasattr(progress_entry, key):
            setattr(progress_entry, key, value)
    
    db.commit()
    db.refresh(progress_entry)
    return progress_entry

def update_progress_photo(
        db: Session,
        progress_photo_id: UUID,
        user_id: UUID,
        update_data: dict
) -> Optional[ProgressPhoto]:
    
    progress_photo = get_progress_photo_by_id(db, progress_photo_id, user_id)

    if not progress_photo:
        return None
    
    for key, value in update_data.items():
        if value is not None and hasattr(progress_photo, key):
            setattr(progress_photo, key, value)
    
    db.commit()
    db.refresh(progress_photo)
    return progress_photo

def delete_progress_entry(
        db:Session,
        progress_entry_id: UUID,
        user_id: UUID,
) -> bool:
    
    progress_entry = get_progress_entry_by_id(db, progress_entry_id, user_id)

    if not progress_entry:
        return False
    
    db.delete(progress_entry)
    db.commit()

    return True

def delete_progress_photo(
        db:Session,
        progress_photo_id: UUID,
        user_id: UUID,
) -> bool:
    
    progress_photo = get_progress_photo_by_id(db, progress_photo_id, user_id)

    if not progress_photo:
        return False
    
    db.delete(progress_photo)
    db.commit()
    
    return True
