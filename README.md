# Meal Planner

A full-stack AI-powered meal and workout planning app. Enter your goals, diet, and fitness level — the app generates a personalized weekly meal plan and workout schedule, tracks your pantry, and builds your shopping list automatically.

## Features

- **AI meal planning** — Claude generates 7 days of recipes tailored to your calorie target, diet type, allergies, and cuisine preferences
- **AI workout planning** — Personalized weekly workout schedule based on your fitness level, equipment, and goals
- **Nutrition facts** — Full FDA-style nutrition label on every recipe (calories, protein, carbs, fat, fiber, sodium, cholesterol)
- **Shopping list** — Auto-generated from your weekly plan, cross-referenced against your pantry
- **Pantry tracker** — Mark items as purchased to update your inventory
- **TDEE calculation** — Mifflin-St Jeor BMR with activity multiplier and goal adjustment
- **Onboarding wizard** — 6-step profile setup before accessing the app

## Tech Stack

**Backend**
- FastAPI + SQLAlchemy (PostgreSQL)
- JWT authentication (python-jose + bcrypt)
- Anthropic Claude (`claude-sonnet-4-6`) for meal and workout generation
- USDA FoodData Central API for nutritional data
- Alembic for database migrations

**Frontend**
- Next.js 16 (App Router)
- Tailwind CSS v4
- Fetch-based API client with JWT token storage

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for PostgreSQL)
- Anthropic API key

### 1. Database

```bash
docker run -d \
  --name meal-planner-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mealplanner \
  -p 5433:5432 \
  postgres:15
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mealplanner
SECRET_KEY=your-secret-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key
USDA_API_KEY=DEMO_KEY  # or get a free key at fdc.nal.usda.gov
```

```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`

## Project Structure

```
meal-planner/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers
│   │   ├── crud/            # Database operations
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # AI generation, nutrition lookup
│   │   └── main.py
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── (auth)/          # Login, register, onboarding
    │   └── (app)/           # Dashboard, recipes, shopping list, pantry, profile
    ├── components/
    └── lib/api.js           # API client
```

## User Flow

1. Register → 6-step onboarding (goals, stats, fitness, diet, cooking)
2. Generate AI meal + workout plan for the week
3. View weekly dashboard with clickable meal and workout cards
4. Check shopping list and mark items as bought (adds to pantry)
5. Edit profile anytime to regenerate a new plan
