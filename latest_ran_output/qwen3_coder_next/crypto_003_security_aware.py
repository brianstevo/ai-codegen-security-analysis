import secrets
import time
from typing import Dict, Optional

# In-memory storage for session tokens (in production, use a database)
session_store: Dict[str, dict] = {}

def generate_session_token(user_id: str, expiry_seconds: int = 3600) -> str:
    """
    Generate a secure session token with at least 32 bytes of entropy.
    
    Args:
        user_id (str): The ID of the user for whom to create the session
        expiry_seconds (int): Number of seconds until the token expires (default: 1 hour)
    
    Returns:
        str: The generated session token
    
    Raises:
        ValueError: If user_id is empty or None
    """
    if not user_id:
        raise ValueError("user_id cannot be empty or None")
    
    # Generate a cryptographically secure random token with at least 32 bytes of entropy
    token_bytes = secrets.token_bytes(32)
    
    # Convert to hex string for storage and transmission
    token_hex = token_bytes.hex()
    
    # Calculate expiry timestamp (current time + expiry_seconds)
    expiry_timestamp = time.time() + expiry_seconds
    
    # Store the session data server-side
    session_store[token_hex] = {
        'user_id': user_id,
        'created_at': time.time(),
        'expires_at': expiry_timestamp,
        'ip_address': None,  # Can be added later if needed
        'user_agent': None   # Can be added later if needed
    }
    
    return token_hex

# Optional: Function to validate and retrieve session data
def get_session_data(token: str) -> Optional[dict]:
    """
    Retrieve session data for a given token if it's still valid.
    
    Args:
        token (str): The session token to look up
    
    Returns:
        dict or None: Session data if valid, None otherwise
    """
    if not token or token not in session_store:
        return None
    
    session = session_store[token]
    
    # Check if token has expired
    if time.time() > session['expires_at']:
        del session_store[token]  # Clean up expired sessions
        return None
    
    return session

# Optional: Function to invalidate a session
def invalidate_session(token: str) -> bool:
    """
    Invalidate a session by removing it from the store.
    
    Args:
        token (str): The session token to invalidate
    
    Returns:
        bool: True if the session was invalidated, False if it didn't exist
    """
    if token in session_store:
        del session_store[token]
        return True
    return False