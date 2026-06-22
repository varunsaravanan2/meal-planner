import json
from datetime import date, timedelta
from anthropic import Anthropic
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.user_profile import UserProfile
from app.crud.recipe import create_recipe
from app.crud.meal_plan import create_meal_plan
from app.models.meal_plan import MealPlan
from app.models.recipe import Recipe
from app.crud.workout_plan import clear_week as clear_workout_week, create_workout
from app.services.nutrition import lookup_ingredient
from app.config import settings

client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _extract_json(text: str) -> dict:
    """Strip markdown fences, find the JSON object, and parse it. Retries once on failure."""
    text = text.strip()

    # Strip ```json ... ``` or ``` ... ``` fences
    if text.startswith("```"):
        lines = text.splitlines()
        end = next((i for i in range(len(lines) - 1, 0, -1) if lines[i].strip() == "```"), len(lines))
        text = "\n".join(lines[1:end]).strip()
        if text.startswith("json"):
            text = text[4:].strip()

    # Find the first { in case Claude prefixed with explanation text
    brace = text.find("{")
    if brace > 0:
        text = text[brace:]

    # Find the matching closing brace to handle trailing text after the JSON
    depth = 0
    end_idx = len(text)
    for i, ch in enumerate(text):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end_idx = i + 1
                break
    text = text[:end_idx]

    return json.loads(text)


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


GOAL_MACRO_PROFILES = {
    "lose_weight": {
        "protein_pct": 0.40, "fat_pct": 0.25, "carb_pct": 0.35,
        "strategy": (
            "MAXIMUM protein — 45% of calories. Target ~1g protein per 4 calories, which is the physical ceiling for real food. "
            "Every single meal must be built around a lean protein source first: "
            "chicken breast (31g/100g), canned tuna (25g/100g), egg whites (11g/100g), non-fat Greek yogurt (10g/100g), "
            "cottage cheese (11g/100g), shrimp (24g/100g), cod (18g/100g), turkey breast (29g/100g). "
            "Carbs only from high-fiber, low-calorie sources: broccoli, spinach, cauliflower, zucchini, cucumber. "
            "Use minimal fat — cooking spray not oil, no butter, no heavy sauces. "
            "A 400-calorie meal should have AT LEAST 40–50g of protein. "
            "Avoid: rice, pasta, bread, potatoes, oils, cheese, nuts (high calorie-to-protein ratio). "
            "Each meal must feel filling despite low calories — use volume (vegetables) and protein for satiety."
        ),
    },
    "build_muscle": {
        "protein_pct": 0.40, "fat_pct": 0.25, "carb_pct": 0.35,
        "strategy": (
            "VERY HIGH protein — 40% of calories — plus strategic carbs for training fuel and glycogen. "
            "Build every meal around a protein anchor: lean beef (26g/100g), chicken thighs (25g/100g), "
            "salmon (25g/100g), eggs, Greek yogurt, cottage cheese, edamame. "
            "Carbs should be complex and timed: oats, sweet potato, brown rice, quinoa, whole grain bread. "
            "A 600-calorie meal should have 55–65g protein. "
            "Include at least one post-workout recovery meal with fast carbs (white rice or banana) + 40g+ protein. "
            "Larger portions — meals are calorie-dense but protein is always the biggest macro by calories."
        ),
    },
    "maintain": {
        "protein_pct": 0.35, "fat_pct": 0.30, "carb_pct": 0.35,
        "strategy": (
            "High protein (35%) for body composition maintenance. "
            "Rotate protein sources weekly: chicken, fish, eggs, legumes, Greek yogurt. "
            "Balanced carbs from whole grains and vegetables. Healthy fats from avocado, olive oil, nuts (in moderation). "
            "A 500-calorie meal should have 40–50g protein."
        ),
    },
    "improve_performance": {
        "protein_pct": 0.35, "fat_pct": 0.25, "carb_pct": 0.40,
        "strategy": (
            "High protein (35%) for muscle repair and recovery, with carb-forward fueling for training. "
            "Pre-workout meals: complex carbs + moderate protein. Post-workout: fast carbs + 40g+ protein. "
            "Anti-inflammatory proteins: salmon, sardines, eggs. Complex carbs: oats, sweet potato, quinoa. "
            "A 500-calorie meal should have 40–50g protein."
        ),
    },
    "eat_healthier": {
        "protein_pct": 0.35, "fat_pct": 0.30, "carb_pct": 0.35,
        "strategy": (
            "High protein (35%) from whole food sources. Whole foods only — no processed ingredients. "
            "Protein sources: fish, chicken, legumes, eggs, Greek yogurt. "
            "Vegetables at every meal. Minimize added sugars, sodium, and refined carbs. "
            "A 500-calorie meal should have 40–50g protein."
        ),
    },
}

def calculate_macros(tdee: int, goal: str) -> dict:
    profile = GOAL_MACRO_PROFILES.get(goal, GOAL_MACRO_PROFILES["eat_healthier"])
    return {
        "protein_g":   round(tdee * profile["protein_pct"] / 4),
        "carbs_g":     round(tdee * profile["carb_pct"]    / 4),
        "fat_g":       round(tdee * profile["fat_pct"]     / 9),
        "protein_pct": profile["protein_pct"],
        "strategy":    profile["strategy"],
    }


def build_prompt(profile: UserProfile, tdee: int, monday: date) -> str:
    days = [(monday + timedelta(days=i)).isoformat() for i in range(7)]
    goal = profile.primary_goal or "eat_healthier"
    macros = calculate_macros(tdee, goal)

    return f"""You are a precision nutritionist and meal planner. Generate a 7-day meal plan as compact JSON.

## User profile
- Goal: {goal.replace('_', ' ')}
- Daily calories: {tdee} kcal
- Daily protein target: {macros['protein_g']}g ({round(macros['protein_g'] * 4 / tdee * 100)}% of calories)
- Daily carbs target: {macros['carbs_g']}g ({round(macros['carbs_g'] * 4 / tdee * 100)}% of calories)
- Daily fat target: {macros['fat_g']}g ({round(macros['fat_g'] * 9 / tdee * 100)}% of calories)
- Diet: {profile.diet_type or 'no restriction'}
- Allergies/avoid: {', '.join(a for a in (profile.allergies or []) if a != 'none') or 'none'}
- Dislikes: {profile.disliked_foods or 'none'}
- Preferred cuisines: {', '.join(profile.cuisine_preferences or []) or 'any'}
- Cooking skill: {profile.cooking_skill or 'intermediate'}
- Max cook time: {profile.max_cook_time or '30-60'} min

## Nutrition strategy for this goal
{macros['strategy']}

## Dates
{', '.join(days)}

## Output format
Return ONLY valid JSON, no markdown, no extra text:
{{"days":[{{"date":"YYYY-MM-DD","meals":[{{"slot":"breakfast","title":"Name","description":"Brief","prep_time":10,"cook_time":15,"servings":1,"cuisine":"American","category":"breakfast","ingredients":[{{"name":"oats","quantity":"0.5","unit":"cup"}}],"steps":["Step 1","Step 2"],"calories":350,"protein_g":12,"carbs_g":55,"fat_g":8,"saturated_fat_g":2,"fiber_g":4,"sugar_g":6,"sodium_mg":400,"cholesterol_mg":30}}]}}]}}

## Rules
- Honor all dietary restrictions and allergies strictly
- No repeated recipes across the 7 days
- Calories per day: ~25% breakfast, ~35% lunch, ~40% dinner, totaling ~{tdee} kcal
- Protein per day MUST hit ~{macros['protein_g']}g — every single meal must contain a substantial protein source, not just dinner
- Each recipe must be built around a high-protein ingredient first — the protein content drives the meal design, not the other way around
- Double-check each meal's protein_g before outputting: a {round(tdee * 0.25)}-calorie meal needs at least {round(tdee * 0.25 * macros['protein_pct'] / 4)}g protein
- Every recipe's macros MUST reflect the goal strategy — the ingredient list must justify the protein numbers
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
    # Delete all meal plan entries that reference AI-generated recipes (any week)
    # so the FK constraint is satisfied before deleting the recipes themselves
    ai_recipe_ids = db.query(Recipe.id).filter(
        Recipe.user_id == user_id,
        Recipe.source_url == "ai-generated",
    ).subquery()
    db.query(MealPlan).filter(
        MealPlan.user_id == user_id,
        MealPlan.recipe_id.in_(ai_recipe_ids),
    ).delete(synchronize_session="fetch")
    db.commit()
    # Now safe to delete the AI-generated recipes
    db.query(Recipe).filter(
        Recipe.user_id == user_id,
        Recipe.source_url == "ai-generated",
    ).delete()
    db.commit()


def _call_claude(prompt: str, max_tokens: int, temperature: float) -> str:
    return client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    ).content[0].text.strip()


def _fetch_meal_plan(profile: UserProfile, tdee: int, monday: date) -> dict:
    prompt = build_prompt(profile, tdee, monday)
    raw = _call_claude(prompt, max_tokens=16000, temperature=0.7)
    try:
        return _extract_json(raw)
    except json.JSONDecodeError:
        # Retry once at temperature=0 for more deterministic output
        raw = _call_claude(prompt, max_tokens=16000, temperature=0)
        return _extract_json(raw)


def _fetch_workout_plan(profile: UserProfile, monday: date) -> dict:
    prompt = build_workout_prompt(profile, monday)
    raw = _call_claude(prompt, max_tokens=4000, temperature=0.5)
    try:
        return _extract_json(raw)
    except json.JSONDecodeError:
        raw = _call_claude(prompt, max_tokens=4000, temperature=0)
        return _extract_json(raw)


def generate_week_plan(db: Session, user_id: UUID, profile: UserProfile, monday: date) -> dict:
    from concurrent.futures import ThreadPoolExecutor

    tdee = calculate_tdee(profile)

    # Fetch meal plan and workout plan from Claude in parallel
    with ThreadPoolExecutor(max_workers=2) as pool:
        meal_future    = pool.submit(_fetch_meal_plan, profile, tdee, monday)
        workout_future = pool.submit(_fetch_workout_plan, profile, monday)
        plan_data    = meal_future.result()
        workout_data = workout_future.result()

    # Persist meals
    clear_week(db, user_id, monday)
    meals_created = 0
    for day in plan_data.get("days", []):
        planned_date = date.fromisoformat(day["date"])
        for meal in day.get("meals", []):
            usda_data = None
            if meal.get("ingredients") and settings.USDA_API_KEY != "DEMO_KEY":
                usda_data = lookup_ingredient(meal["ingredients"][0]["name"], settings.USDA_API_KEY)

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
                nutrition={
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
                },
                category=meal.get("category"),
                cuisine=meal.get("cuisine"),
                source_url="ai-generated",
            )
            create_meal_plan(
                db=db, user_id=user_id, recipe_id=recipe.id,
                planned_date=planned_date, meal_slot=meal["slot"],
                servings=meal.get("servings", 1),
            )
            meals_created += 1

    # Persist workouts
    clear_workout_week(db, user_id, monday)
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
