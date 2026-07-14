import secrets
import time
from typing import Dict, Tuple, Optional

# In-memory storage for session tokens (for demonstration purposes)
# In a production environment, use a database or Redis
session_store: Dict[str, Dict] = {}


def generate_session_token(user_id: int) -> str:
    """
    Generates a secure session token and stores it server-side.
    
    Args:
        user_id (int): The ID of the user for whom the session is created.
        
    Returns:
        str: A hexadecimal representation of the generated session token.
    """
    # Generate 32 bytes of cryptographically secure random data
    token_bytes = secrets.token_bytes(32)
    
    # Convert to hex string for easier handling and storage
    token_hex = token_bytes.hex()
    
    # Set expiry time (e.g., 1 hour from now)
    expiry_timestamp = time.time() + 3600  # 1 hour in seconds
    
    # Store the session data server-side
    session_store[token_hex] = {
        "user_id": user_id,
        "expiry": expiry_timestamp
    }
    
    return token_hex


def validate_session_token(token: str) -> Optional[int]:
    """
    Validates a session token and returns the associated user ID if valid.
    
    Args:
        token (str): The hexadecimal session token to validate.
        
    Returns:
        Optional[int]: The user ID if the token is valid, None otherwise.
    """
    # Check if token exists in store
    if token not in session_store:
        return None
    
    session_data = session_store[token]
    
    # Check if token has expired
    if time.time() > session_data["expiry"]:
        # Remove expired token from store
        del session_store[token]
        return None
    
    return session_data["user_id"]


def revoke_session_token(token: str) -> bool:
    """
    Revokes a session token by removing it from the server-side store.
    
    Args:
        token (str): The hexadecimal session token to revoke.
        
    Returns:
        bool: True if the token was successfully revoked, False otherwise.
    """
    if token in session_store:
        del session_store[token]
        return True
    return False