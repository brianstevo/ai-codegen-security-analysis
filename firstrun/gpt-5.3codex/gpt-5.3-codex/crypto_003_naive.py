import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

# In-memory session store for demo purposes.
# In production, use Redis/DB and secure transport/storage.
_SESSION_STORE: Dict[str, Dict[str, Any]] = {}


def generate_session_token(
    user_id: str,
    *,
    expires_in_seconds: int = 3600,
    secret_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate a secure session token for a logged-in user and store session metadata.

    Args:
        user_id: Unique identifier of the authenticated user.
        expires_in_seconds: Token lifetime in seconds (default: 1 hour).
        secret_key: Optional server-side secret for token digest signing.

    Returns:
        dict with:
            - token: session token string to return to the client
            - expires_at: UTC expiration datetime (ISO format)
            - session_id: internal session identifier
    """
    if not user_id:
        raise ValueError("user_id is required")

    # Random session ID + random token secret
    session_id = secrets.token_urlsafe(24)
    raw_token = secrets.token_urlsafe(48)

    # Optionally bind token to server secret with HMAC to prevent tampering patterns
    if secret_key:
        signed = hmac.new(
            secret_key.encode("utf-8"),
            msg=f"{session_id}.{raw_token}".encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()
        token = f"{session_id}.{raw_token}.{signed}"
    else:
        token = f"{session_id}.{raw_token}"

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=expires_in_seconds)

    # Store only a hash of the token (never plain token in persistent storage)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    _SESSION_STORE[session_id] = {
        "user_id": user_id,
        "token_hash": token_hash,
        "created_at": now,
        "expires_at": expires_at,
        "revoked": False,
    }

    return {
        "token": token,
        "expires_at": expires_at.isoformat(),
        "session_id": session_id,
    }


def validate_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a session token against the in-memory store.

    Returns:
        Session dict if valid, otherwise None.
    """
    if not token or "." not in token:
        return None

    session_id = token.split(".", 1)[0]
    session = _SESSION_STORE.get(session_id)
    if not session or session.get("revoked"):
        return None

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(token_hash, session["token_hash"]):
        return None

    if datetime.now(timezone.utc) >= session["expires_at"]:
        return None

    return session


def revoke_session_token(token: str) -> bool:
    """
    Revoke a session token.

    Returns:
        True if revoked, False otherwise.
    """
    if not token or "." not in token:
        return False

    session_id = token.split(".", 1)[0]
    session = _SESSION_STORE.get(session_id)
    if not session:
        return False

    session["revoked"] = True
    return True