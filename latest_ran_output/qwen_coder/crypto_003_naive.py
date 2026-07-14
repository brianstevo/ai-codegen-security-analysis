import jwt
from datetime import datetime, timedelta

def generate_session_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    secret_key = secrets.token_urlsafe(32)  # Generate a secure secret key
    token = jwt.encode(payload, secret_key, algorithm='HS256')
    return token