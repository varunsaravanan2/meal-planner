# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v2.0.0] — 2026-06-10

### Changed
- Migrated entire frontend from JavaScript (JSX) to TypeScript (TSX)
- Added shared type interfaces in `frontend/types/index.ts` for all data models
- Rewrote `lib/api` as typed `api.ts` with generic `request<T>` function
- All React state and props are now fully typed

---

## [v1.0.0] — 2026-06-09

### Added
- Full-stack meal planning app: FastAPI backend + Next.js 16 frontend
- JWT authentication (register, login, protected routes)
- AI-powered meal plan generation using Claude (claude-sonnet-4-6)
- AI workout plan generation tailored to user fitness profile
- Recipe management: manual entry, AI text extraction, Instagram URL extraction
- Weekly meal plan calendar with drag-to-add meals
- Shopping list auto-generated from weekly meal plan, cross-referenced with pantry
- Pantry inventory tracking with categories and location
- Multi-step onboarding wizard (goals, body stats, activity, diet, cooking preferences)
- Profile settings page for updating preferences and regenerating plans
- Nutrition facts display per recipe (calories, macros, micronutrients)
- PostgreSQL database via SQLAlchemy with Alembic migrations
- Docker setup for local PostgreSQL
