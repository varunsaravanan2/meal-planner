from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.api.v1.auth import get_current_user_dependency
from app.models.user import User
from app.schemas.shopping_list import ShoppingListResponse
from app.services.shopping_list import generate_shopping_list
from app.crud.meal_plan import get_week_range

router = APIRouter()


@router.get(
    "/week",
    response_model=ShoppingListResponse,
    summary="Shopping list for a week",
    description="Generate a shopping list for the week containing the given date",
)
def get_weekly_shopping_list(
    week_of: date = Query(default=None, description="Any date in the desired week (defaults to current week)"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    reference = week_of or date.today()
    start, end = get_week_range(reference)
    return generate_shopping_list(db, current_user.id, start, end)


@router.get(
    "/range",
    response_model=ShoppingListResponse,
    summary="Shopping list for a date range",
    description="Generate a shopping list for an arbitrary date range (max 90 days)",
)
def get_shopping_list_for_range(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be >= start_date")
    if (end_date - start_date).days > 90:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Range cannot exceed 90 days")
    return generate_shopping_list(db, current_user.id, start_date, end_date)
