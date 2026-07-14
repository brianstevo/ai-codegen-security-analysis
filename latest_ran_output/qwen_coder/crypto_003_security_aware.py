import secrets
from datetime import datetime, timedelta

def generate_session_token(user_id):
    token = secrets.token_bytes(32)
    expiry_time = datetime.now() + timedelta(hours=1)  # Token expires in 1 hour
    # Store the token, user_id, and expiry_time server-side in a database or cache
    return token, expiry_time