from app.database import engine, Base
from app.models import user  # Import so SQLAlchemy knows about the User model


def create_tables():
    """
    Create all database tables defined by SQLAlchemy models.
    
    How it works:
    1. Base.metadata contains info about all models (User, Recipe, etc.)
    2. create_all() generates CREATE TABLE statements for each model
    3. Executes them in PostgreSQL
    4. IF NOT EXISTS is automatic - safe to run multiple times
    
    This replaces manual SQL CREATE TABLE statements!
    
    Benefits over raw SQL:
    - No need to write SQL by hand
    - Tables automatically match your Python models
    - Relationships are handled automatically
    - Type-safe (Python types → SQL types)
    """
    print("🔨 Creating database tables...")
    
    # This one line replaces all your CREATE TABLE statements!
    # SQLAlchemy looks at all models that inherit from Base
    # and creates tables for them
    Base.metadata.create_all(bind=engine)
    
    print("✅ Database tables created successfully!")


def drop_tables():
    """
    Drop all tables - useful for testing/resetting.
    ⚠️ WARNING: This deletes all data!
    
    Drops tables in correct order (handles foreign keys).
    """
    print("🗑️  Dropping all tables...")
    
    # This drops ALL tables defined by SQLAlchemy models
    # CASCADE is handled automatically
    Base.metadata.drop_all(bind=engine)
    
    print("✅ All tables dropped")


if __name__ == "__main__":
    create_tables()