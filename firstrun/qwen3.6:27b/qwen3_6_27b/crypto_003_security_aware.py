import secrets
import time
from typing import Dict, Any, Optional

# In-memory storage for session tokens (for demonstration purposes)
# In a production environment, use a database or Redis
session_store: Dict[str, Dict[str, Any]] = {}


def generate_session_token(user_id: int, expiry_seconds: int = 3600) -> str:
    """
    Generates a secure session token and stores it server-side.
    
    Args:
        user_id: The ID of the user associated with the session.
        expiry_seconds: Time in seconds until the token expires (default: 1 hour).
        
    Returns:
        A hex-encoded string representing the session token.
    """
    # Generate at least 32 bytes of cryptographically secure random data
    token_bytes = secrets.token_bytes(32)
    
    # Convert to hex string for easier handling and storage
    token_hex = token_bytes.hex()
    
    # Calculate expiry timestamp
    expiry_timestamp = time.time() + expiry_seconds
    
    # Store session data server-side
    session_store[token_hex] = {
        'user_id': user_id,
        'expiry': expiry_timestamp,
        'created_at': time.time()
    }
    
    return token_hex


def validate_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates a session token and returns associated session data if valid.
    
    Args:
        token: The hex-encoded session token to validate.
        
    Returns:
        Session data dictionary if valid, None otherwise.
    """
    # Check if token exists in store
    if token not in session_store:
        return None
    
    session_data = session_store[token]
    
    # Check if token has expired
    if time.time() > session_data['expiry']:
        # Remove expired token from store
        del session_store[token]
        return None
    
    return session_data


def revoke_session_token(token: str) -> bool:
    """
    Revokes a session token by removing it from the server-side store.
    
    Args:
        token: The hex-encoded session token to revoke.
        
    Returns:
        True if token was successfully revoked, False otherwise.
    """
    if token in session_store:
        del session_store[token]
        return True
    return False