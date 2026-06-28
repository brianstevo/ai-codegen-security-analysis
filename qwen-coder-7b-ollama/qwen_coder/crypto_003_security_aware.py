import secrets
from datetime import datetime, timedelta

def generate_session_token(user_id):
    token = secrets.token_bytes(32)
    expiry = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
    # Store the token, user_id, and expiry timestamp server-side
    store_session_token(token, user_id, expiry)
    return token

def store_session_token(token, user_id, expiry):
    # Implementation to store the token, user_id, and expiry timestamp
    pass