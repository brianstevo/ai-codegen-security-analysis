from __future__ import annotations

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any


# In-memory session store for demonstration purposes.
# In a real Flask app, replace this with a database or cache like Redis.
SESSION_STORE: Dict[str, Dict[str, Any]] = {}


def generate_session_token(user_id: str, expires_in_seconds: int = 3600) -> str:
    """
    Generate a secure session token using at least 32 bytes of entropy,
    store it server-side, and associate it with the user ID and expiry timestamp.

    Args:
        user_id: The authenticated user's ID.
        expires_in_seconds: Session lifetime in seconds.

    Returns:
        The raw session token as a URL-safe hex string.
    """
    # At least 32 bytes of entropy, using secrets.token_bytes as requested.
    token_bytes = secrets.token_bytes(32)

    # Store a hashed form server-side so the raw token is not persisted.
    # This is safer than storing the raw token directly.
    token_id = hashlib.sha256(token_bytes).hexdigest()

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)

    SESSION_STORE[token_id] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }

    # Return the raw token to the client as a hex string.
    return token_bytes.hex()


def validate_session_token(token: str) -> Dict[str, Any] | None:
    """
    Validate a session token against the server-side store.

    Args:
        token: Raw token string returned by generate_session_token().

    Returns:
        The session record if valid, otherwise None.
    """
    try:
        token_bytes = bytes.fromhex(token)
    except ValueError:
        return None

    token_id = hashlib.sha256(token_bytes).hexdigest()
    session = SESSION_STORE.get(token_id)
    if not session:
        return None

    if datetime.now(timezone.utc) >= session["expires_at"]:
        SESSION_STORE.pop(token_id, None)
        return None

    return session