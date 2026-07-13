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
        dict: Contains the token and metadata including expiration time
    """
    # Create a timestamp for when the token is issued
    issued_at = int(time.time())
    
    # Set expiration to 24 hours from now
    expires_in = 86400  # 24 hours in seconds
    expires_at = issued_at + expires_in
    
    # Create payload with user info and timestamps
    payload = {
        "user_id": user_id,
        "iat": issued_at,
        "exp": expires_at
    }
    
    # Convert payload to string for hashing
    payload_str = f"{payload['user_id']}:{payload['iat']}:{payload['exp']}"
    
    # Create signature using HMAC with SHA-256
    signature = hashlib.sha256(
        (payload_str + secret_key).encode()
    ).hexdigest()
    
    # Combine payload and signature into the token
    token = f"{payload_str}:{signature}"
    
    return {
        "token": token,
        "expires_at": datetime.utcfromtimestamp(expires_at),
        "user_id": user_id
    }