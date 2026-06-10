from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Annotated

from app.database import get_db  # ← Changed from app.db.connection
from app.crud.user import get_user_by_email, create_user  # ← Changed from app.db.user_queries
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.core.security import verify_password, create_access_token, get_email_from_token


# Create router
router = APIRouter()


# OAuth2 scheme for extracting tokens
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account with email and password"
)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)  # ← SQLAlchemy session instead of raw connection
):
    """
    Register a new user.
    
    Changes from raw SQL version:
    - Use db.query() instead of cursor.execute()
    - Work with User objects instead of dicts
    - Automatic transaction management (commit/rollback)
    - Type-safe (User object has autocomplete)
    
    Process:
    1. Receive email + password from request body
    2. Validate using Pydantic (UserCreate schema)
    3. Check if email already exists
    4. Create user (hash password, insert into DB)
    5. Return user info (without password)
    
    Args:
        user: UserCreate schema with email and password
        db: Database session (provided by FastAPI dependency)
    
    Returns:
        201 Created + UserResponse (user data without password)
    
    Raises:
        400 Bad Request: Email already registered
        500 Internal Server Error: Database error
    """
    # Check if user already exists
    # SQLAlchemy version: Returns User object or None
    # Raw SQL version: Returns dict or None
    existing_user = get_user_by_email(db, user.email)
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    # create_user() handles hashing, inserting, and returning User object
    # No need to manually commit - create_user() does it
    try:
        new_user = create_user(db, user.email, user.password)
        
        # Return User object
        # Pydantic automatically converts User object to UserResponse
        # Filters out hashed_password (not in UserResponse schema)
        return new_user
        
    except Exception as e:
        # Log the error in production (use logging library)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.post(
    "/login",
    response_model=Token,
    summary="Login to get access token",
    description="Authenticate with email and password to receive JWT token"
)
def login(
    user: UserLogin,
    db: Session = Depends(get_db)  # ← SQLAlchemy session
):
    """
    Login and receive access token.
    
    Changes from raw SQL version:
    - db_user is a User object (not dict)
    - Access password with db_user.hashed_password (not db_user["hashed_password"])
    - Type-safe (IDE knows what fields exist)
    
    Process:
    1. Receive email + password
    2. Find user in database
    3. Verify password matches hash
    4. Generate JWT token
    5. Return token
    
    Args:
        user: UserLogin schema with email and password
        db: Database session
    
    Returns:
        200 OK + Token (access_token and token_type)
    
    Raises:
        401 Unauthorized: Invalid email or password
    """
    # Check if user exists
    # Returns User object (not dict!)
    db_user = get_user_by_email(db, user.email)
    
    if not db_user:
        # Same error for "user not found" and "wrong password"
        # Prevents email enumeration attacks
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    # db_user.hashed_password ← Object attribute (not dict key!)
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    # db_user.email ← Object attribute
    access_token = create_access_token(
        data={"sub": db_user.email}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get information about the currently authenticated user"
)
def get_current_user_endpoint(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db)  # ← SQLAlchemy session
):
    """
    Get current logged-in user info.
    
    This is a PROTECTED route - requires valid JWT token.
    
    Changes from raw SQL version:
    - User object returned (not dict)
    - Type-safe access (user.email, user.id, etc.)
    
    Args:
        token: JWT token (automatically extracted from header)
        db: Database session
    
    Returns:
        200 OK + UserResponse (current user data)
    
    Raises:
        401 Unauthorized: Invalid/expired token or user not found
    """
    # Decode token to get email
    email = get_email_from_token(token)
    
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    # Returns User object (not dict!)
    user = get_user_by_email(db, email)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Return User object
    # Pydantic converts to UserResponse (filters out password)
    return user


@router.post(
    "/logout",
    summary="Logout",
    description="Logout (client should delete token)"
)
def logout():
    """
    Logout endpoint.
    
    JWT tokens are stateless - server doesn't track them.
    Client is responsible for deleting the token.
    
    Returns:
        200 OK + success message
    """
    return {
        "message": "Successfully logged out",
        "instructions": "Client should delete the access token"
    }


# Helper dependency for other routers
def get_current_user_dependency(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db)
):
    """
    Reusable dependency to get current user.
    
    Use this in other routers that need authentication.
    
    Example:
        from app.api.v1.auth import get_current_user_dependency
        
        @router.get("/recipes")
        def get_my_recipes(
            current_user = Depends(get_current_user_dependency),
            db: Session = Depends(get_db)
        ):
            # current_user is a User object
            recipes = db.query(Recipe).filter(Recipe.user_id == current_user.id).all()
            return recipes
    
    Returns:
        User object if authenticated
    
    Raises:
        401 Unauthorized if token invalid
    """
    email = get_email_from_token(token)
    
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_email(db, email)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user