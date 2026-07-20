import secrets
import time
from typing import Optional, Dict, Any

# Server-side session store.
# In production, use Redis, a database, or another shared persistent store.
SESSION_STORE: Dict[str, Dict[str, Any]] = {}


def generate_session_token(user_id: str, ttl_seconds: int = 3600) -> str:
    """
    Generate a cryptographically secure session token with at least 32 bytes
    of entropy, store it server-side, and associate it with a user ID and expiry.
    """
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")

    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + ttl_seconds

    SESSION_STORE[token] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }

    return token


def get_session_user_id(token: str) -> Optional[str]:
    """
    Validate a session token and return the associated user ID if valid.
    """
    session = SESSION_STORE.get(token)

    if not session:
        return None

    if session["expires_at"] <= int(time.time()):
        SESSION_STORE.pop(token, None)
        return None

    return session["user_id"]


def revoke_session_token(token: str) -> None:
    """
    Revoke a session token server-side.
    """
    SESSION_STORE.pop(token, None)