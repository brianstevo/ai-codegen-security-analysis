import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone


def generate_session_token(user_id: str, secret_key: str, expires_in_minutes: int = 60) -> str:
    """
    Generate a secure session token for a logged-in user.

    Returns a token string containing:
      - user_id
      - expiration timestamp
      - random nonce
      - HMAC signature

    Example token format:
      user_id.expiry.nonce.signature
    """
    expiry = int((datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)).timestamp())
    nonce = secrets.token_urlsafe(32)

    payload = f"{user_id}.{expiry}.{nonce}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"{payload}.{signature}"