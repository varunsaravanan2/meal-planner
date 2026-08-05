from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import user, recipe, inventory, meal_plan, user_profile, workout_plan, subscription, plan_snapshot, workout_template, progress, food_log
from app.api.v1 import auth, recipes, inventory as inventory_router, meal_plan as meal_plan_router, shopping_list as shopping_list_router, user_profile as user_profile_router, workout_plan as workout_router, billing as billing_router, plan_snapshots as snapshots_router, workout_templates as workout_templates_router, progress as progress_router, food_log as food_log_router


app = FastAPI(
    title="Meal Planner API",
    description="AI-powered meal planning from Instagram recipes",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created!")
    print("Meal Planner API is ready!")

app.include_router(
    progress_router.router,
    prefix="/api/v1/progress",
    tags=["Progress"]
)

# Include routers
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Authentication"]
)

app.include_router(
    recipes.router,
    prefix="/api/v1/recipes",
    tags=["Recipes"]
)

app.include_router(
    user_profile_router.router,
    prefix="/api/v1/profile",
    tags=["User Profile"]
)

app.include_router(
    inventory_router.router,
    prefix="/api/v1/inventory",
    tags=["Inventory"]
)

app.include_router(
    meal_plan_router.router,
    prefix="/api/v1/meal-plan",
    tags=["Meal Plan"]
)

app.include_router(
    shopping_list_router.router,
    prefix="/api/v1/shopping-list",
    tags=["Shopping List"]
)

app.include_router(
    workout_router.router,
    prefix="/api/v1/workouts",
    tags=["Workouts"]
)

app.include_router(
    billing_router.router,
    prefix="/api/v1/billing",
    tags=["Billing"]
)

app.include_router(
    snapshots_router.router,
    prefix="/api/v1/plan-snapshots",
    tags=["Plan Snapshots"]
)

app.include_router(
    workout_templates_router.router,
    prefix="/api/v1/workout-templates",
    tags=["Workout Templates"]
)

app.include_router(
    food_log_router.router,
    prefix="/api/v1/food-log",
    tags=["Food Log"]
)


@app.get("/")
async def root():
    return {
        "message": "Meal Planner API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# instagram thumbnail that leads to JCBME.coach, at the bottom
# weekly view should be in dashboard - done
# widget on dashboard with all workout plans - done
# cheat meal highlight in weekly plan - done
# workout types(chest, back, legs, etc) - done
# strength workout plan in paid plans, 30 minute consultation (1 week)
# 30 days of workouts and meals, 30 minute constultation per week (1 month)
# Schedule with Josh for 1 hour meeting, bring up Josh's calendar and enable them to choose one slot (one time purchase, $100)