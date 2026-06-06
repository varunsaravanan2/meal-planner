import bcrypt as _bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional, Dict
from app.config import settings


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Bcrypt automatically:
    - Generates a random salt
    - Applies the salt to the password
    - Hashes with multiple rounds (slow = secure)
    
    The same password hashed twice gives different results:
    hash_password("test") → "$2b$12$abc..."
    hash_password("test") → "$2b$12$xyz..."  (different!)
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string (safe to store in database)
        Format: "$2b$12$..." (bcrypt identifier + salt + hash)
        
    Example:
        hashed = hash_password("mypassword")
        # "$2b$12$KIXl3eQx9yVt3rLj8Z..."
        
    Security:
    - Salt prevents rainbow table attacks
    - Slow hashing prevents brute force
    - One-way (can't reverse to get original password)
    """
    truncated = password.encode("utf-8")[:72]
    return _bcrypt.hashpw(truncated, _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Process:
    1. Extract salt from hashed_password
    2. Hash plain_password with the same salt
    3. Compare the results
    
    Args:
        plain_password: Password user typed (e.g., at login)
        hashed_password: Hash from database
        
    Returns:
        True if passwords match, False otherwise
        
    Example:
        # At registration:
        hashed = hash_password("mypassword")
        # Store hashed in database
        
        # At login:
        is_valid = verify_password("mypassword", hashed)
        # True!
        
        is_valid = verify_password("wrongpassword", hashed)
        # False!
    
    Note: This is intentionally slow (prevents brute force)
    Takes ~100ms per verification
    """
    truncated = plain_password.encode("utf-8")[:72]
    return _bcrypt.checkpw(truncated, hashed_password.encode("utf-8"))


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Token contains:
    - User identifier (usually email)
    - Expiration time
    - Issued-at time
    
    Token is signed with SECRET_KEY so we can verify it later.
    
    Args:
        data: Dictionary to encode in token (usually {"sub": email})
              "sub" = subject = the user this token is for
        expires_delta: How long token is valid (optional)
                      Default: settings.ACCESS_TOKEN_EXPIRE_MINUTES
        
    Returns:
        Encoded JWT token string
        
    Example:
        token = create_access_token(data={"sub": "user@example.com"})
        # "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        
        # With custom expiration (1 hour):
        token = create_access_token(
            data={"sub": "user@example.com"},
            expires_delta=timedelta(hours=1)
        )
        
    Security:
    - Signed with SECRET_KEY (can't be tampered with)
    - Has expiration (can't use forever)
    - Contains only non-sensitive data (no passwords!)
    """
    to_encode = data.copy()
    
    # Calculate expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # Add standard JWT claims
    to_encode.update({
        "exp": expire,  # Expiration time
        "iat": datetime.utcnow()  # Issued at time
    })
    
    # Encode the token
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict]:
    """
    Decode and verify a JWT token.
    
    Checks:
    1. Token signature is valid (signed with our SECRET_KEY)
    2. Token hasn't expired
    3. Token format is correct
    
    Args:
        token: JWT token string
        
    Returns:
        Dict with token payload if valid:
        {
            'sub': 'user@example.com',
            'exp': 1234567890,
            'iat': 1234567800
        }
        
        None if token is invalid
        
    Example:
        # Valid token:
        payload = decode_access_token("eyJhbGci...")
        if payload:
            email = payload.get("sub")
            print(f"Token is for: {email}")
        
        # Invalid/expired token:
        payload = decode_access_token("invalid_token")
        # Returns None
        
    Common failures:
    - Token expired (exp < now)
    - Token tampered with (signature invalid)
    - Wrong SECRET_KEY used
    - Malformed token string
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        # Catches: ExpiredSignatureError, JWTDecodeError, etc.
        return None


def get_email_from_token(token: str) -> Optional[str]:
    """
    Extract email from a JWT token.
    
    Convenience function - combines decode + extract email.
    
    Args:
        token: JWT token string
        
    Returns:
        Email string if valid token, None otherwise
        
    Example:
        email = get_email_from_token("eyJhbGci...")
        if email:
            print(f"User is: {email}")
        else:
            print("Invalid token")
    """
    payload = decode_access_token(token)
    if payload is None:
        return None
    
    # JWT standard: "sub" (subject) contains user identifier
    return payload.get("sub")


def create_refresh_token(data: Dict) -> str:
    """
    Create a refresh token (long-lived).
    
    Refresh tokens:
    - Last longer than access tokens (7-30 days)
    - Used to get new access tokens
    - Stored securely on client
    
    Args:
        data: Dictionary to encode (usually {"sub": email})
        
    Returns:
        Encoded refresh token
        
    Example:
        refresh_token = create_refresh_token({"sub": "user@example.com"})
        # User stores this, uses it to get new access tokens
        
    Note: This is optional - only needed if you want refresh tokens.
    For now, users just re-login when access token expires.
    """
    return create_access_token(
        data=data,
        expires_delta=timedelta(days=7)  # 7 days
    )