import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.crud.subscription import get_or_create_free, activate_paid
from app.models.subscription import PLAN_PRICES

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(tags=["billing"])

PLAN_DAYS = {"week": 7, "month": 30, "3month": 90}


@router.get("/status")
def subscription_status(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sub = get_or_create_free(db, current_user.id)
    from datetime import timezone
    return {
        "plan_type": sub.plan_type,
        "status": sub.status,
        "generations_used": sub.generations_used,
        "generations_limit": sub.generations_limit,
        "generations_remaining": max(0, sub.generations_limit - sub.generations_used),
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
    }


@router.post("/create-checkout")
def create_checkout(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    plan_type = body.get("plan_type")
    if plan_type not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan type.")

    price = PLAN_PRICES[plan_type]
    days = PLAN_DAYS[plan_type]

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": price["currency"],
                "product_data": {
                    "name": f"Meal Planner — {price['label']}",
                    "description": f"{days}-day AI meal planning access",
                },
                "unit_amount": price["amount"],
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded=1",
        cancel_url=f"{settings.FRONTEND_URL}/pricing",
        metadata={
            "user_id": str(current_user.id),
            "plan_type": plan_type,
        },
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")
        plan_type = session["metadata"].get("plan_type")
        if user_id and plan_type:
            activate_paid(db, user_id, plan_type, session["id"])

    return {"received": True}
