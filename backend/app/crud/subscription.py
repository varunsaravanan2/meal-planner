from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timezone, timedelta
from uuid import UUID

from app.models.subscription import Subscription, PLAN_LIMITS


def get_active_subscription(db: Session, user_id: UUID) -> Subscription | None:
    now = datetime.now(timezone.utc)
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status == "active",
        )
        .order_by(desc(Subscription.created_at))
        .first()
    )
    if not sub:
        return None
    # Expire if past expiry date
    if sub.expires_at and sub.expires_at < now:
        sub.status = "expired"
        db.commit()
        return None
    return sub


def get_or_create_free(db: Session, user_id: UUID) -> Subscription:
    sub = get_active_subscription(db, user_id)
    if sub:
        return sub
    # Create the free tier for new users
    free = Subscription(
        user_id=user_id,
        plan_type="free",
        status="active",
        generations_used=0,
        generations_limit=PLAN_LIMITS["free"]["generations"],
        expires_at=None,
    )
    db.add(free)
    db.commit()
    db.refresh(free)
    return free


def can_generate(sub: Subscription) -> bool:
    return sub.generations_used < sub.generations_limit


def increment_generations(db: Session, sub: Subscription) -> Subscription:
    sub.generations_used += 1
    db.commit()
    db.refresh(sub)
    return sub


def activate_paid(db: Session, user_id: UUID, plan_type: str, stripe_session_id: str) -> Subscription:
    limits = PLAN_LIMITS[plan_type]
    days = limits["days"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=days) if days else None

    # Expire any existing active free/paid sub
    db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status == "active",
    ).update({"status": "expired"})
    db.commit()

    sub = Subscription(
        user_id=user_id,
        plan_type=plan_type,
        status="active",
        stripe_session_id=stripe_session_id,
        generations_used=0,
        generations_limit=limits["generations"],
        expires_at=expires_at,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub
