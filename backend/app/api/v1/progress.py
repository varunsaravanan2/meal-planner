from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.crud.progress import (
    get_progress_entry_by_id, get_progress_photo_by_id, get_all_progress_entries,
    get_all_photos_for_entry, create_user_progress_entry,
    create_progress_photo, update_progress_entry,
    delete_progress_entry, delete_progress_photo
)
from app.services.storage import upload_photo, delete_photo

router = APIRouter(tags=["progress"])

class ProgressEntryIn(BaseModel):
    week_date: date
    weight_lbs: Optional[float] = None

class ProgressEntryUpdate(BaseModel):
    weight_lbs: Optional[float] = None

def _serialize_entry(e) -> dict:
    return {
        "id": str(e.id),
        "week_date": str(e.week_date),
        "weight_lbs": e.weight_lbs,
        "created_at": str(e.created_at),
    }

def _serialize_photo(p) -> dict:
    return {
        "id": str(p.id),
        "progress_entry_id": str(p.progress_entry_id),
        "url": p.url,
        "label": p.label,
        "created_at": str(p.created_at),
    }

@router.post("/{entry_id}/photos")
async def upload_progress_photo(
    entry_id: str,
    file: UploadFile = File(...),
    label: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = get_progress_entry_by_id(db, entry_id, current_user.id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    
    file_bytes = await file.read()
    s3_key, url = upload_photo(file_bytes, file.filename, str(current_user.id))
    
    photo = create_progress_photo(db, current_user.id, entry.id, s3_key, url, label)
    return _serialize_photo(photo)

@router.get("")
def get_all_entries(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entries = get_all_progress_entries(db, current_user.id)
    return [_serialize_entry(e) for e in entries]


@router.get("/{entry_id}/photos")
def get_photos_for_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = get_progress_entry_by_id(db, entry_id, current_user.id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    photos = get_all_photos_for_entry(db, entry.id, current_user.id)
    return [_serialize_photo(p) for p in photos]


@router.post("")
def create_entry(
    body: ProgressEntryIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = create_user_progress_entry(db, current_user.id, body.week_date, body.weight_lbs)
    return _serialize_entry(entry)


@router.put("/{entry_id}")
def edit_entry(
    entry_id: str,
    body: ProgressEntryUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = update_progress_entry(db, entry_id, current_user.id, body.model_dump())
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    return _serialize_entry(entry)


@router.delete("/{entry_id}")
def remove_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    deleted = delete_progress_entry(db, entry_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found.")
    return {"deleted": True}


@router.delete("/photos/{photo_id}")
def remove_photo(
    photo_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    photo = get_progress_photo_by_id(db, photo_id, current_user.id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found.")
    delete_photo(photo.s3_key)
    delete_progress_photo(db, photo_id, current_user.id)
    return {"deleted": True}
