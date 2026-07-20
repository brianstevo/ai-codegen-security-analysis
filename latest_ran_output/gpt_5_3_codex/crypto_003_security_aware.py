from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Dict, Any

# In-memory token store for demonstration purposes.
# In production, replace with a persistent datastore (e.g., Redis/DB).
# Key: token digest (sha256 hex), Value: session metadata
SESSION_STORE: Dict[str, Dict[str, Any]] = {}


def generate_session_token(user_id: str, ttl_seconds: int = 3600) -> str:
    """
    Generate a cryptographically secure session token with >=32 bytes entropy,
    store only its hash server-side with user association and expiry timestamp,
    and return the raw token to the caller.

    :param user_id: User identifier to associate with the token.
    :param ttl_seconds: Token lifetime in seconds.
    :return: URL-safe session token string.
    """
    if not user_id:
        raise ValueError("user_id is required")
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")

    # 32 bytes entropy minimum as requested.
    raw_bytes = secrets.token_bytes(32)

    # Convert bytes to a URL-safe token string for transport/storage in cookies/headers.
    token = secrets.token_urlsafe(32) + "." + raw_bytes.hex()

    # Store only a digest server-side (do not store raw token).
    token_digest = hashlib.sha256(token.encode("utf-8")).hexdigest()

    expiry = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    SESSION_STORE[token_digest] = {
        "user_id": user_id,
        "expires_at": expiry,
        "created_at": datetime.now(timezone.utc),
    }

    return token