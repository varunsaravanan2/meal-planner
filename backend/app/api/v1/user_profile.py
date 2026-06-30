from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.v1.auth import get_current_user_dependency as get_current_user
from app.schemas.user_profile import UserProfileUpdate, UserProfileOut
from app.crud.user_profile import get_profile, upsert_profile
from app.services.meal_plan_generator import generate_week_plan
from app.crud.subscription import get_or_create_free

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

@router.post("/generate-goals")
def generate_nutritional_goals(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.services.meal_plan_generator import client as ai_client
    import json

    sub = get_or_create_free(db, current_user.id)
    if sub.plan_type == "free":
        raise HTTPException(status_code=402, detail="AI goal generation requires a paid plan.")

    profile = get_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=400, detail="Complete your profile first.")

    prompt = f"""Based on this user's profile, calculate their daily nutritional goals.

Profile:
- Age: {profile.age}, Sex: {profile.sex}
- Height: {profile.height_ft}ft {profile.height_in}in, Weight: {profile.weight_lbs}lbs
- Goal: {profile.primary_goal}, Activity level: {profile.activity_level}
- Target weight: {profile.target_weight_lbs}lbs
- Diet type: {profile.diet_type}

Return ONLY valid JSON with these exact keys (integers):
{{"calorie_goal": 2000, "protein_goal_g": 150, "carbs_goal_g": 200, "fat_goal_g": 65}}

Use standard TDEE formulas (Mifflin-St Jeor). Adjust for goal:
- lose_weight: 300-500 cal deficit
- build_muscle: 200-300 cal surplus
- maintain: TDEE"""

    response = ai_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    try:
        start, end = raw.index("{"), raw.rindex("}") + 1
        goals = json.loads(raw[start:end])
    except Exception:
        raise HTTPException(status_code=500, detail="Could not parse AI response.")

    updated = upsert_profile(db, current_user.id, UserProfileUpdate(**goals))
    return {
        "calorie_goal": updated.calorie_goal,
        "protein_goal_g": updated.protein_goal_g,
        "carbs_goal_g": updated.carbs_goal_g,
        "fat_goal_g": updated.fat_goal_g,
    }


@router.post("/generate-plan")
def generate_plan(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    import traceback
    from app.crud.subscription import get_or_create_free, can_generate, increment_generations
    from app.crud.plan_snapshot import save_snapshot

    profile = get_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=400, detail="Complete your profile before generating a plan.")

    sub = get_or_create_free(db, current_user.id)
    if not can_generate(sub):
        raise HTTPException(
            status_code=402,
            detail=f"You've used all {sub.generations_limit} AI generation(s) on your {sub.plan_type} plan. Upgrade to generate more.",
        )

    monday = date.today() - __import__("datetime").timedelta(days=date.today().weekday())

    # Save current plan as a snapshot before overwriting
    try:
        from app.crud.meal_plan import get_meal_plans_for_range, get_week_range
        start, end = get_week_range(monday)
        entries = get_meal_plans_for_range(db, current_user.id, start, end)
        if entries:
            days_map: dict = {}
            for e in entries:
                key = e.planned_date.isoformat()
                if key not in days_map:
                    days_map[key] = []
                r = e.recipe
                days_map[key].append({
                    "slot": e.meal_slot,
                    "title": r.title if r else "",
                    "description": r.description if r else None,
                    "category": r.category if r else None,
                    "cuisine": r.cuisine if r else None,
                    "prep_time": r.prep_time if r else None,
                    "cook_time": r.cook_time if r else None,
                    "servings": e.servings,
                    "ingredients": [{"name": i.name, "quantity": str(i.quantity), "unit": i.unit} for i in (r.ingredients_list or [])] if r else [],
                    "steps": r.steps or [] if r else [],
                    "nutrition": r.nutrition or {} if r else {},
                })
            save_snapshot(db, current_user.id, monday, {
                "days": [{"date": k, "meals": v} for k, v in sorted(days_map.items())]
            })
    except Exception:
        pass  # Never block generation due to snapshot failure

    try:
        result = generate_week_plan(db, current_user.id, profile, monday)
        increment_generations(db, sub)
        result["generations_remaining"] = max(0, sub.generations_limit - sub.generations_used - 1)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))