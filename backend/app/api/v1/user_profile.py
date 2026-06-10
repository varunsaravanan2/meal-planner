from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.schemas.user_profile import UserProfileUpdate, UserProfileOut
from app.crud.user_profile import get_profile, upsert_profile
from app.services.meal_plan_generator import generate_week_plan

router = APIRouter(tags=["profile"])

@router.get("", response_model=Optional[UserProfileOut])
def read_profile(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_profile(db, current_user.id)

@router.put("", response_model=UserProfileOut)
def save_profile(
    profile_data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return upsert_profile(db, current_user.id, profile_data)

@router.post("/generate-plan")
def generate_plan(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    profile = get_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=400, detail="Complete your profile before generating a plan.")

    monday = date.today() - __import__("datetime").timedelta(days=date.today().weekday())
    result = generate_week_plan(db, current_user.id, profile, monday)
    return result