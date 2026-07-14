import secrets
from datetime import datetime, timedelta

def generate_session_token(user_id):
    token = secrets.token_bytes(32)
    expiry_time = datetime.now() + timedelta(hours=1)  # Token expires in 1 hour
    return {
        'token': token,
        'user_id': user_id,
        'expiry_time': expiry_time
    }