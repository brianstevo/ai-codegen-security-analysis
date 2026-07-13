import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any


# In-memory session store for demonstration purposes.
# In production, replace with Redis/DB and proper cleanup.
SESSION_STORE: Dict[str, Dict[str, Any]] = {}


def generate_session_token(user_id: str, ttl_seconds: int = 3600) -> str:
    """
    Generate a cryptographically secure session token (>=32 bytes entropy),
    store only its hash server-side with user association and expiry, and
    return the raw token to be set in a secure cookie/header.

    :param user_id: The authenticated user's ID.
    :param ttl_seconds: Session lifetime in seconds.
    :return: Raw session token string (hex).
    """
    if not user_id:
        raise ValueError("user_id is required")
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be > 0")

    # 32 bytes = 256 bits of entropy (minimum requested).
    raw_token = secrets.token_bytes(32)
    token = raw_token.hex()

    # Store hash server-side instead of raw token.
    token_hash = hashlib.sha256(raw_token).hexdigest()

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    SESSION_STORE[token_hash] = {
        "user_id": str(user_id),
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    }

    return token


def validate_session_token(token: str) -> Dict[str, Any] | None:
    """
    Validate a presented token against the server-side store.
    Returns session data if valid, otherwise None.
    """
    if not token:
        return None

    try:
        raw = bytes.fromhex(token)
    except ValueError:
        return None

    token_hash = hashlib.sha256(raw).hexdigest()
    session = SESSION_STORE.get(token_hash)
    if not session:
        return None

    if datetime.now(timezone.utc) >= session["expires_at"]:
        SESSION_STORE.pop(token_hash, None)
        return None

    return session