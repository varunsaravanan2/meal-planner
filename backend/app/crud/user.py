from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password
from uuid import UUID
from typing import Optional


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Find a user by their email address.
    
    SQLAlchemy version vs Raw SQL:
    
    Raw SQL:
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
    
    SQLAlchemy:
        user = db.query(User).filter(User.email == email).first()
    
    Benefits:
    - Type-safe (User object, not dict)
    - IDE autocomplete works (user.email, user.id, etc.)
    - No SQL injection possible (SQLAlchemy handles escaping)
    - Returns None if not found (no need to check)
    
    Args:
        db: Database session
        email: User's email to search for
        
    Returns:
        User object if found, None if not found
        
    Example:
        user = get_user_by_email(db, "test@example.com")
        if user:
            print(f"Found user: {user.email}")
            print(f"ID: {user.id}")
        else:
            print("User not found")
    """
    return db.query(User).filter(User.email == email).first()
    # .query(User) → SELECT * FROM users
    # .filter(User.email == email) → WHERE email = 'email'
    # .first() → LIMIT 1, return None if not found


def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    """
    Find a user by their ID.
    
    Args:
        db: Database session
        user_id: User's UUID
        
    Returns:
        User object if found, None if not found
        
    Example:
        from uuid import UUID
        user_id = UUID('123e4567-e89b-12d3-a456-426614174000')
        user = get_user_by_id(db, user_id)
    """
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, email: str, password: str) -> User:
    """
    Create a new user in the database.
    
    SQLAlchemy version vs Raw SQL:
    
    Raw SQL:
        hashed_password = hash_password(password)
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (%s, %s) RETURNING *",
            (email, hashed_password)
        )
        user = cursor.fetchone()
    
    SQLAlchemy:
        db_user = User(email=email, hashed_password=hash_password(password))
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    
    Benefits:
    - Object-oriented (create Python object, not SQL)
    - Automatic ID generation (uuid.uuid4)
    - Automatic timestamps (created_at, updated_at)
    - Type-safe (User object, not dict)
    - db.refresh() gets auto-generated values from database
    
    Args:
        db: Database session
        email: User's email
        password: Plain text password (will be hashed)
        
    Returns:
        User object (newly created)
        
    Raises:
        IntegrityError: If email already exists (UNIQUE constraint)
        
    Example:
        user = create_user(db, "new@example.com", "password123")
        print(f"Created user with ID: {user.id}")
    """
    # Hash the password before storing (NEVER store plain passwords!)
    hashed_password = hash_password(password)
    
    # Create User object
    # At this point, it's just a Python object - not in database yet
    # SQLAlchemy will auto-generate: id, created_at, updated_at
    db_user = User(
        email=email,
        hashed_password=hashed_password
    )
    
    # Add to session (stages the insert)
    # Session tracks this object - knows it needs to be inserted
    db.add(db_user)
    
    # Commit transaction (actually executes INSERT)
    # This is when the SQL is sent to PostgreSQL
    # If this fails, everything in the session is rolled back
    db.commit()
    
    # Refresh to get auto-generated fields
    # This does a SELECT to get: id, created_at, updated_at
    # Now db_user.id is set (was None before)
    db.refresh(db_user)
    
    return db_user


def update_user_password(db: Session, user_id: UUID, new_password: str) -> Optional[User]:
    """
    Update a user's password.
    
    SQLAlchemy version vs Raw SQL:
    
    Raw SQL:
        hashed = hash_password(new_password)
        cursor.execute(
            "UPDATE users SET hashed_password = %s, updated_at = NOW() WHERE id = %s",
            (hashed, user_id)
        )
    
    SQLAlchemy:
        user = db.query(User).filter(User.id == user_id).first()
        user.hashed_password = hash_password(new_password)
        db.commit()
    
    Benefits:
    - Work with objects, not SQL
    - updated_at is automatically updated (onupdate in model)
    - Type-safe
    
    Args:
        db: Database session
        user_id: User's UUID
        new_password: New plain text password (will be hashed)
        
    Returns:
        Updated User object if found, None if user doesn't exist
        
    Example:
        user = update_user_password(db, user_id, "newpassword456")
        if user:
            print("Password updated!")
        else:
            print("User not found")
    """
    # Get the user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        return None
    
    # Update the password
    user.hashed_password = hash_password(new_password)
    
    # Commit changes
    # updated_at is automatically set (because of onupdate in model)
    db.commit()
    
    # Refresh to get updated fields
    db.refresh(user)
    
    return user


def delete_user(db: Session, user_id: UUID) -> bool:
    """
    Delete a user from the database.
    
    Args:
        db: Database session
        user_id: User's UUID
        
    Returns:
        True if user was deleted, False if user not found
        
    Example:
        success = delete_user(db, user_id)
        if success:
            print("User deleted")
        else:
            print("User not found")
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        return False
    
    # Delete the user
    db.delete(user)
    db.commit()
    
    return True


def get_all_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    """
    Get all users with pagination.
    
    Pagination = Getting results in chunks (like pages in a book)
    
    Args:
        db: Database session
        skip: How many users to skip (for pagination)
        limit: Maximum number of users to return
        
    Returns:
        List of User objects
        
    Example:
        # Get first 10 users
        users = get_all_users(db, skip=0, limit=10)
        
        # Get next 10 users (page 2)
        users = get_all_users(db, skip=10, limit=10)
        
        # Get users 20-30 (page 3)
        users = get_all_users(db, skip=20, limit=10)
    """
    return db.query(User).offset(skip).limit(limit).all()
    # .offset(skip) → OFFSET in SQL (skip N rows)
    # .limit(limit) → LIMIT in SQL (return max N rows)
    # .all() → Execute query and return list


def user_exists(db: Session, email: str) -> bool:
    """
    Check if a user with this email exists.
    
    More efficient than get_user_by_email() when you only need yes/no.
    
    Args:
        db: Database session
        email: Email to check
        
    Returns:
        True if user exists, False otherwise
        
    Example:
        if user_exists(db, "test@example.com"):
            print("Email is taken")
    """
    # .count() is more efficient than .first() for existence checks
    # Generates: SELECT COUNT(*) FROM users WHERE email = '...'
    return db.query(User).filter(User.email == email).count() > 0