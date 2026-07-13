import secrets
import time
from typing import Optional, Dict

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
    """
    # Generate at least 32 bytes of cryptographically secure random data
    token_bytes = secrets.token_bytes(32)
    
    # Convert to hex string for storage and transmission
    token = token_bytes.hex()
    
    # Calculate expiry timestamp (current time + expiry_seconds)
    expiry_timestamp = time.time() + expiry_seconds
    
    # Store session data server-side
    session_store[token] = {
        'user_id': user_id,
        'created_at': time.time(),
        'expires_at': expiry_timestamp
    }
    
    return token

# Example usage (not part of the function, but for reference):
# token = generate_session_token("user123", 7200)  # 2 hour expiry