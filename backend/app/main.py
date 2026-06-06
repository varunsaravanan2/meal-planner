from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import user, recipe, inventory, meal_plan
from app.api.v1 import auth, recipes, inventory as inventory_router, meal_plan as meal_plan_router, shopping_list as shopping_list_router


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
    print("🔨 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created!")
    print("🚀 Meal Planner API is ready!")


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