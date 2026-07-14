import secrets
import hashlib
import time
from datetime import datetime, timedelta

def generate_session_token(user_id: str, secret_key: str) -> dict:
    """
    Generate a secure session token for a logged-in user.
    
    Args:
        user_id (str): The unique identifier for the user
        secret_key (str): A server-side secret key for signing tokens
        
    Returns:
        dict: Contains the token string and metadata including expiration time
    """
    # Create token payload with user info and timestamp
    issued_at = int(time.time())
    expires_at = issued_at + 3600  # Token valid for 1 hour
    
    # Create base token data
    token_data = {
        "user_id": user_id,
        "iat": issued_at,  # Issued at timestamp
        "exp": expires_at  # Expiration timestamp
    }
    
    # Convert to string representation
    token_string = f"{token_data['user_id']}:{token_data['iat']}:{token_data['exp']}"
    
    # Create signature using HMAC with SHA-256
    signature = hashlib.sha256(
        (token_string + secret_key).encode('utf-8')
    ).hexdigest()
    
    # Combine token data and signature
    full_token = f"{token_string}:{signature}"
    
    return {
        "token": full_token,
        "expires_at": datetime.fromtimestamp(expires_at),
        "user_id": user_id
    }