import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from app.config import settings


def get_db_connection():
    """
    Create a connection to PostgreSQL database.
    
    Uses DATABASE_URL from settings, which is a full connection string.
    Format: postgresql://user:password@host:port/database
    """
    try:
        connection = psycopg2.connect(
            settings.DATABASE_URL,
            cursor_factory=RealDictCursor
        )
        print("✅ Database connection established")
        return connection
    except Exception as error:
        print(f"❌ Error connecting to database: {error}")
        raise  # Re-raise the error so caller knows it failed


@contextmanager
def get_db():
    """
    Context manager for database transactions.
    
    Usage:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users")
    """
    connection = get_db_connection()
    try:
        yield connection
        connection.commit()
        print("✅ Transaction committed")
    except Exception as e:
        connection.rollback()
        print(f"❌ Transaction rolled back: {e}")
        raise e
    finally:
        connection.close()
        print("🔒 Database connection closed")