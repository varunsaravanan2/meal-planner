from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from uuid import UUID
from typing import Optional


class UserCreate(BaseModel):
    """
    Schema for creating a new user (registration).
    
    Used when: POST /api/v1/auth/register
    
    Validation:
    - email must be valid email format (has @ and domain)
    - password must be at least 8 characters
    
    Example valid input:
    {
        "email": "user@example.com",
        "password": "secure123"
    }
    
    Example invalid inputs:
    {
        "email": "not-an-email",      # Invalid email
        "password": "secure123"
    }
    {
        "email": "user@example.com",
        "password": "short"            # Too short
    }
    """
    email: EmailStr
    password: str = Field(
        min_length=8,
        description="Password must be at least 8 characters",
        examples=["secure_password_123"]
    )


class UserLogin(BaseModel):
    """
    Schema for user login.
    
    Used when: POST /api/v1/auth/login
    
    Similar to UserCreate but no minimum password length
    (we're checking existing password, not creating new one)
    
    Example:
    {
        "email": "user@example.com",
        "password": "secure123"
    }
    """
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """
    Schema for returning user data.
    
    Used when: 
    - POST /api/v1/auth/register (response)
    - GET /api/v1/auth/me (response)
    
    IMPORTANT: 
    - Does NOT include hashed_password!
    - Never expose password hashes in API responses
    - Only return public user information
    
    Example response:
    {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "email": "user@example.com",
        "created_at": "2026-01-13T10:30:00",
        "updated_at": "2026-01-13T10:30:00"
    }
    """
    id: UUID
    email: str
    created_at: datetime
    updated_at: datetime
    
    # Pydantic v2 config
    model_config = ConfigDict(
        from_attributes=True,
        # Allows Pydantic to work with SQLAlchemy model objects
        # Example: UserResponse.model_validate(db_user) works
        
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "created_at": "2026-01-13T10:30:00",
                "updated_at": "2026-01-13T10:30:00"
            }
        }
    )


class Token(BaseModel):
    """
    Schema for JWT token response.
    
    Used when: POST /api/v1/auth/login (success response)
    
    OAuth2 standard format:
    - access_token: The JWT token string
    - token_type: Always "bearer" for JWT
    
    Example:
    {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer"
    }
    
    Client uses this in subsequent requests:
    Authorization: Bearer <access_token>
    """
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """
    Schema for data extracted from JWT token.
    
    Used internally when decoding tokens.
    Not returned in API responses.
    
    Contains the user identifier (email) from token payload.
    
    Example:
    token_data = TokenData(email="user@example.com")
    """
    email: Optional[str] = None


class UserUpdate(BaseModel):
    """
    Schema for updating user information.
    
    All fields are optional (only update what's provided).
    
    Example:
    {
        "email": "newemail@example.com"
    }
    or
    {
        "password": "newpassword123"
    }
    or both
    
    Note: This is for future use.
    """
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)