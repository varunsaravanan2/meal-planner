from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date, timedelta
from typing import List, Dict, Any

from app.database import get_db
from app.api.v1.auth import get_current_user_dependency
from app.models.user import User
from app.schemas.food_log import FoodLogCreate, FoodLogOut
from app.crud.food_log import get_food_log_for_date, get_food_log_for_range, create_food_log_entry, delete_food_log_entry

router = APIRouter()


@router.get("/weekly")
def get_weekly_summary(
    week_of: date = Query(..., description="Any date in the week (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    day = week_of
    monday = day - timedelta(days=day.weekday())
    sunday = monday + timedelta(days=6)
    entries = get_food_log_for_range(db, current_user.id, monday, sunday)

    daily: Dict[str, Dict[str, float]] = {}
    for e in entries:
        key = str(e.log_date)
        if key not in daily:
            daily[key] = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "entries": 0}
        daily[key]["calories"] += e.calories or 0
        daily[key]["protein_g"] += e.protein_g or 0
        daily[key]["carbs_g"] += e.carbs_g or 0
        daily[key]["fat_g"] += e.fat_g or 0
        daily[key]["entries"] += 1

    days_logged = len(daily)
    avg_cal = round(sum(d["calories"] for d in daily.values()) / days_logged) if days_logged else 0
    avg_prot = round(sum(d["protein_g"] for d in daily.values()) / days_logged, 1) if days_logged else 0
    avg_carbs = round(sum(d["carbs_g"] for d in daily.values()) / days_logged, 1) if days_logged else 0
    avg_fat = round(sum(d["fat_g"] for d in daily.values()) / days_logged, 1) if days_logged else 0

    return {
        "week_start": str(monday),
        "days_logged": days_logged,
        "avg_calories": avg_cal,
        "avg_protein_g": avg_prot,
        "avg_carbs_g": avg_carbs,
        "avg_fat_g": avg_fat,
        "daily": {k: {**v, "calories": round(v["calories"]), "protein_g": round(v["protein_g"], 1)} for k, v in daily.items()},
    }


@router.get("", response_model=List[FoodLogOut])
def get_log(
    log_date: date = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    return get_food_log_for_date(db, current_user.id, log_date)


@router.post("", response_model=FoodLogOut, status_code=status.HTTP_201_CREATED)
def add_log_entry(
    data: FoodLogCreate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    return create_food_log_entry(db, current_user.id, data)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    if not delete_food_log_entry(db, entry_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
