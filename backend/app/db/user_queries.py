from app.core.security import hash_password
from uuid import UUID
from typing import Optional, Dict

def get_user_by_email(conn, email: str) -> Optional[Dict]:
    """
    Fetch a user by their email address.
    """
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE email = %s;", (email,))
        user = cursor.fetchone()
        return user
    

def get_user_by_id(conn, user_id: UUID) -> Optional[Dict]:
    """
    Fetch a user by their unique ID.
    """
    cursor = conn.cursor()
    cursor.executre("SELECT * FROM users WHERE id = %s;", (str(user_id),))
    user = cursor.fetchone()
    cursor.close()
    return user

def create_user(conn, username: str, email: str, password: str) -> Dict:
    """
    Create a new user in the database.
    
    Process:
    1. Hash the password (NEVER store plain passwords!)
    2. Insert into database
    3. Return the created user
    
    Args:
        conn: Database connection
        email: User's email
        password: Plain text password (will be hashed)
        
    Returns:
        Dict with newly created user data (without password):
        {
            'id': UUID('...'),
            'email': 'user@example.com',
            'created_at': datetime(...),
            'updated_at': datetime(...)
        }
        
    Raises:
        psycopg2.IntegrityError: If email already exists
        
    Example:
        with get_db() as conn:
            user = create_user(conn, "new@example.com", "password123")
            print(f"Created user with ID: {user['id']}")
    """
    hashed_pw = hash_password(password)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO users (username, email, hashed_password)
        VALUES (%s, %s, %s)
        RETURNING id, username, email, created_at, updated_at;
    ''', (username, email, hashed_pw))
    new_user = cursor.fetchone()
    cursor.close()
    return new_user

def update_user_password(conn, user_id: UUID, new_password: str) -> None:
    """
    Update a user's password.
    
    Args:
        conn: Database connection
        user_id: User's UUID
        new_password: New plain text password (will be hashed)
        
    Returns:
        True if user was updated, False if user not found
        
    Example:
        success = update_user_password(conn, user_id, "newpassword456")
        if success:
            print("Password updated!")
    """
    hashed_pw = hash_password(new_password)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users
        SET hashed password = %s, updated at = CURRENT_TIMESTAMP)
        WHERE ID = %s;
    ''', (hashed_pw, str(user_id)))
    updated_rows = cursor.rowcount
    cursor.close()
    return updated_rows > 0

def delete_user(conn, user_id: UUID) -> bool:  
    """
    Delete a user from the database.
    
    Args:
        conn: Database connection
        user_id: User's UUID
        
    Returns:
        True if user was deleted, False if user not found
        
    Example:
        success = delete_user(conn, user_id)
        if success:
            print("User deleted")
        else:
            print("User not found")
    """
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = %s;", (str(user_id),))
    deleted_rows = cursor.rowcount
    cursor.close()
    return deleted_rows > 0

def email_exists(conn, email: str) -> bool:
    '''
    Check if an email already exists in the database.
    
    Convenience function for validation.
    
    Args:
        conn: Database connection
        email: Email to check
        
    Returns:
        True if email exists, False otherwise
        
    Example:
        if email_exists(conn, "test@example.com"):
            print("Email is taken")
    '''
    user = get_user_by_email(conn, email)
    return user is not None


