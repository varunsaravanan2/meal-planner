import json
from datetime import date, timedelta
from anthropic import Anthropic
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.user_profile import UserProfile
from app.crud.recipe import create_recipe
from app.crud.meal_plan import create_meal_plan
from app.models.meal_plan import MealPlan
from app.crud.workout_plan import clear_week as clear_workout_week, create_workout
from app.services.nutrition import lookup_ingredient
from app.config import settings

client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def calculate_tdee(profile: UserProfile) -> int:
    if not (profile.weight_lbs and profile.height_ft and profile.age):
        return 2000

    weight_kg = profile.weight_lbs * 0.453592
    height_cm = ((profile.height_ft or 0) * 12 + (profile.height_in or 0)) * 2.54

    if profile.sex == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * profile.age + 5
    elif profile.sex == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * profile.age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * profile.age - 78

    multipliers = {
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
    }
    tdee = bmr * multipliers.get(profile.activity_level or "sedentary", 1.2)

    adjustments = {"lose_weight": -500, "build_muscle": 300}
    tdee += adjustments.get(profile.primary_goal or "", 0)

    return round(tdee)


def build_prompt(profile: UserProfile, tdee: int, monday: date) -> str:
    days = [(monday + timedelta(days=i)).isoformat() for i in range(7)]

    lines = [
        f"Goal: {profile.primary_goal or 'eat healthier'}",
        f"Daily calorie target: {tdee} kcal",
        f"Diet: {profile.diet_type or 'no restriction'}",
        f"Allergies/avoid: {', '.join(a for a in (profile.allergies or []) if a != 'none') or 'none'}",
        f"Dislikes: {profile.disliked_foods or 'none'}",
        f"Preferred cuisines: {', '.join(profile.cuisine_preferences or []) or 'any'}",
        f"Cooking skill: {profile.cooking_skill or 'intermediate'}",
        f"Max cook time: {profile.max_cook_time or '30-60'} min",
    ]

    return f"""You are a nutritionist. Generate a 7-day meal plan as compact JSON.

User: {'; '.join(lines)}

Dates: {', '.join(days)}

Return ONLY valid JSON, no markdown, no extra text:
{{"days":[{{"date":"YYYY-MM-DD","meals":[{{"slot":"breakfast","title":"Name","description":"Brief","prep_time":10,"cook_time":15,"servings":1,"cuisine":"American","category":"breakfast","ingredients":[{{"name":"oats","quantity":"0.5","unit":"cup"}}],"steps":["Step 1","Step 2"],"calories":350,"protein_g":12,"carbs_g":55,"fat_g":8,"saturated_fat_g":2,"fiber_g":4,"sugar_g":6,"sodium_mg":400,"cholesterol_mg":30}}]}}]}}

Rules:
- Honor all dietary restrictions and allergies strictly
- No repeated recipes across the 7 days
- Calories: ~25% breakfast, ~35% lunch, ~40% dinner, totaling ~{tdee} kcal/day
- Max 4 steps per recipe, max 6 ingredients per recipe
- Short descriptions (under 12 words)
"""


def build_workout_prompt(profile: UserProfile, monday: date) -> str:
    days = [(monday + timedelta(days=i)).isoformat() for i in range(7)]
    return f"""Generate a 7-day workout schedule as compact JSON.

User: fitness_level={profile.fitness_level or 'beginner'}; workouts_per_week={profile.workouts_per_week or 3}; equipment={profile.equipment or ['none']}; preferred_types={profile.workout_types or ['strength']}; injuries={profile.injuries or 'none'}; goal={profile.primary_goal or 'eat healthier'}

Dates: {', '.join(days)}

Return ONLY valid JSON, no markdown:
{{"workouts":[{{"date":"YYYY-MM-DD","rest":true}},{{"date":"YYYY-MM-DD","rest":false,"type":"strength","title":"Upper Body","duration":45,"exercises":[{{"name":"Push-ups","sets":3,"reps":12}},{{"name":"Dumbbell Row","sets":3,"reps":10}}]}}]}}

Rules:
- Schedule exactly {profile.workouts_per_week or 3} workout days, rest days fill the remainder
- Use only the equipment available
- Adjust intensity for fitness level
- 4-6 exercises per workout day
- Respect any injuries
- Vary muscle groups across workout days to avoid back-to-back same groups
"""


def clear_week(db: Session, user_id: UUID, monday: date):
    sunday = monday + timedelta(days=6)
    db.query(MealPlan).filter(
        MealPlan.user_id == user_id,
        MealPlan.planned_date >= monday,
        MealPlan.planned_date <= sunday,
    ).delete()
    db.commit()


def generate_week_plan(db: Session, user_id: UUID, profile: UserProfile, monday: date) -> dict:
    tdee = calculate_tdee(profile)
    prompt = build_prompt(profile, tdee, monday)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        temperature=0.7,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if Claude added them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    plan_data = json.loads(raw)

    # Clear existing week before saving new plan
    clear_week(db, user_id, monday)

    meals_created = 0
    for day in plan_data.get("days", []):
        planned_date = date.fromisoformat(day["date"])
        for meal in day.get("meals", []):
            # Look up USDA nutrition for the first (main) ingredient
            usda_data = None
            if meal.get("ingredients") and settings.USDA_API_KEY != "DEMO_KEY":
                main_ingredient = meal["ingredients"][0]["name"]
                usda_data = lookup_ingredient(main_ingredient, settings.USDA_API_KEY)

            nutrition = {
                "calories": meal.get("calories"),
                "protein_g": meal.get("protein_g"),
                "carbs_g": meal.get("carbs_g"),
                "fat_g": meal.get("fat_g"),
                "saturated_fat_g": meal.get("saturated_fat_g"),
                "fiber_g": meal.get("fiber_g"),
                "sugar_g": meal.get("sugar_g"),
                "sodium_mg": meal.get("sodium_mg"),
                "cholesterol_mg": meal.get("cholesterol_mg"),
                "usda_main_ingredient": usda_data,
            }

            recipe = create_recipe(
                db=db,
                user_id=user_id,
                title=meal["title"],
                description=meal.get("description"),
                ingredients=meal.get("ingredients", []),
                steps=meal.get("steps", []),
                prep_time=meal.get("prep_time"),
                cook_time=meal.get("cook_time"),
                servings=meal.get("servings", 1),
                nutrition=nutrition,
                category=meal.get("category"),
                cuisine=meal.get("cuisine"),
                source_url="ai-generated",
            )

            create_meal_plan(
                db=db,
                user_id=user_id,
                recipe_id=recipe.id,
                planned_date=planned_date,
                meal_slot=meal["slot"],
                servings=meal.get("servings", 1),
            )
            meals_created += 1

    # Generate workout plan
    workout_prompt = build_workout_prompt(profile, monday)
    workout_response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        temperature=0.5,
        messages=[{"role": "user", "content": workout_prompt}],
    )
    workout_raw = workout_response.content[0].text.strip()
    if workout_raw.startswith("```"):
        workout_raw = workout_raw.split("```")[1]
        if workout_raw.startswith("json"):
            workout_raw = workout_raw[4:]

    clear_workout_week(db, user_id, monday)
    workout_data = json.loads(workout_raw)
    for w in workout_data.get("workouts", []):
        create_workout(db, user_id, {
            "planned_date": date.fromisoformat(w["date"]),
            "is_rest_day": w.get("rest", False),
            "workout_type": w.get("type"),
            "title": w.get("title"),
            "duration_minutes": w.get("duration"),
            "exercises": w.get("exercises"),
        })

    return {"meals_created": meals_created, "tdee": tdee, "week_start": monday.isoformat()}
