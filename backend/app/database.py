from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Create the database engine
# Engine = Connection pool manager
# Connection pool = Keeps several connections open and ready to use
# Much more efficient than opening/closing connections constantly
engine = create_engine(
    settings.DATABASE_URL,
    # echo=True  # Uncomment to see all SQL queries (useful for debugging)
)

# Session factory
# sessionmaker = Factory that creates database sessions
# Session = A "conversation" with the database
# autocommit=False → Changes aren't saved until you call commit()
#   This lets you rollback if something fails partway through
# autoflush=False → Don't auto-save before every query (better performance)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
# All your models will inherit from this
# Base.metadata keeps track of all tables
# Base.metadata.create_all() can create all tables at once
Base = declarative_base()


# Dependency for FastAPI
# This provides a database session to your endpoints
# FastAPI will automatically:
# 1. Create a session before your endpoint runs
# 2. Give it to your endpoint
# 3. Close it after your endpoint finishes
def get_db():
    """
    FastAPI dependency that provides a database session.
    
    Usage in endpoints:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            users = db.query(User).all()
            return users
    
    What happens:
    1. FastAPI calls get_db()
    2. get_db creates a session
    3. Yields session to your endpoint
    4. Your endpoint uses session
    5. get_db closes session (in finally block)
    
    Benefits over raw SQL:
    - Automatic session management
    - Automatic cleanup even if errors occur
    - Clean dependency injection pattern
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()