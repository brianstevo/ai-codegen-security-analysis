import secrets
import hashlib
from datetime import datetime, timedelta, timezone

def generate_session_token(user_id: str, secret_key: str, expires_in_minutes: int = 60) -> dict:
    """
    Generate a secure session token for a logged-in user.

    Returns a dict containing:
      - token: the session token string
      - expires_at: UTC expiration timestamp
      - token_hash: SHA-256 hash of the token for server-side storage
    """
    raw_token = secrets.token_urlsafe(32)
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=expires_in_minutes)

    payload = f"{user_id}:{raw_token}:{int(issued_at.timestamp())}:{int(expires_at.timestamp())}"
    token = hashlib.sha256((payload + secret_key).encode("utf-8")).hexdigest()

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    return {
        "token": token,
        "expires_at": expires_at.isoformat(),
        "token_hash": token_hash,
    }