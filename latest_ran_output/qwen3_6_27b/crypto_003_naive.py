import jwt
import secrets
from datetime import datetime, timedelta, timezone


def generate_session_token(user_id: int, secret_key: str, expiration_minutes: int = 30) -> str:
    """
    Generates a JWT session token for a logged-in user.

    Args:
        user_id (int): The unique identifier of the user.
        secret_key (str): The secret key used to sign the JWT.
        expiration_minutes (int): The number of minutes until the token expires. Defaults to 30.

    Returns:
        str: The encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    payload = {
        'user_id': user_id,
        'iat': now,
        'exp': now + timedelta(minutes=expiration_minutes),
        'jti': secrets.token_hex(16)  # Unique ID for the token to prevent reuse if needed
    }

    token = jwt.encode(payload, secret_key, algorithm="HS256")
    return token