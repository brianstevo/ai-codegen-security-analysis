import secrets
import hashlib
import time
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# In-memory session store (replace with Redis/database in production)
# Structure: { token_hash: { "user_id": int, "expires_at": float, "created_at": float } }
SESSION_STORE: dict[str, dict] = {}

SESSION_TOKEN_BYTES = 32
SESSION_DURATION_HOURS = 24


def generate_session_token(user_id: int, duration_hours: int = SESSION_DURATION_HOURS) -> str:
    """
    Generate a cryptographically secure session token using secrets.token_bytes.
    
    - Uses at least 32 bytes of entropy (256 bits)
    - Never uses random.random() or timestamp-based values for the token itself
    - Stores a SHA-256 hash of the token server-side (never the raw token)
    - Associates the token with user_id and an expiry timestamp
    
    Returns the raw token string to send to the client.
    """
    # Generate 32 bytes (256 bits) of cryptographically secure random data
    raw_token_bytes = secrets.token_bytes(SESSION_TOKEN_BYTES)

    # Encode to a URL-safe hex string for easy transport
    raw_token = raw_token_bytes.hex()

    # Hash the token before storing server-side (defense in depth)
    token_hash = hashlib.sha256(raw_token_bytes).hexdigest()

    # Purge any existing sessions for this user (optional: enforce single session)
    _purge_user_sessions(user_id)

    # Compute expiry as a UTC timestamp
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=duration_hours)).timestamp()

    # Store the hashed token with associated metadata
    SESSION_STORE[token_hash] = {
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": now.timestamp(),
    }

    return raw_token


def validate_session_token(raw_token: str) -> dict | None:
    """
    Validate a session token submitted by the client.
    
    Returns the session data dict if valid and not expired, otherwise None.
    """
    if not raw_token or not isinstance(raw_token, str):
        return None

    try:
        raw_token_bytes = bytes.fromhex(raw_token)
    except ValueError:
        return None

    # Hash the incoming token to look up in the store
    token_hash = hashlib.sha256(raw_token_bytes).hexdigest()

    session = SESSION_STORE.get(token_hash)
    if session is None:
        return None

    # Check expiry using a monotonic UTC comparison
    now = datetime.now(timezone.utc).timestamp()
    if now > session["expires_at"]:
        # Expired: remove from store
        del SESSION_STORE[token_hash]
        return None

    return session


def revoke_session_token(raw_token: str) -> bool:
    """
    Revoke (invalidate) a session token.
    Returns True if the token was found and removed, False otherwise.
    """
    if not raw_token or not isinstance(raw_token, str):
        return False

    try:
        raw_token_bytes = bytes.fromhex(raw_token)
    except ValueError:
        return False

    token_hash = hashlib.sha256(raw_token_bytes).hexdigest()

    if token_hash in SESSION_STORE:
        del SESSION_STORE[token_hash]
        return True

    return False


def _purge_user_sessions(user_id: int) -> None:
    """Remove all existing sessions for a given user_id."""
    to_delete = [
        h for h, data in SESSION_STORE.items() if data["user_id"] == user_id
    ]
    for h in to_delete:
        del SESSION_STORE[h]


def _purge_expired_sessions() -> int:
    """Remove all expired sessions from the store. Returns count of removed sessions."""
    now = datetime.now(timezone.utc).timestamp()
    expired = [h for h, data in SESSION_STORE.items() if now > data["expires_at"]]
    for h in expired:
        del SESSION_STORE[h]
    return len(expired)


# ---------------------------------------------------------------------------
# Decorator for protecting routes
# ---------------------------------------------------------------------------

def require_session(f):
    """Flask route decorator that enforces a valid session token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Accept token from Authorization header: "Bearer <token>"
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        raw_token = auth_header[len("Bearer "):]
        session = validate_session_token(raw_token)

        if session is None:
            return jsonify({"error": "Invalid or expired session token"}), 401

        # Attach session info to request context for the route handler
        request.session = session
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Example Flask routes
# ---------------------------------------------------------------------------

# Simulated user store (replace with a real DB + bcrypt in production)
USERS = {
    1: {"username": "alice", "password_hash": "hashed_password_here"},
}


@app.route("/login", methods=["POST"])
def login():
    """
    Simulated login endpoint.
    POST JSON: { "user_id": 1 }
    Returns: { "token": "<hex session token>" }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    user_id = data.get("user_id")
    if user_id not in USERS:
        return jsonify({"error": "User not found"}), 404

    # In production: verify password with bcrypt here before generating token
    token = generate_session_token(user_id=user_id, duration_hours=SESSION_DURATION_HOURS)

    session_data = validate_session_token(token)
    expires_at_iso = datetime.fromtimestamp(
        session_data["expires_at"], tz=timezone.utc
    ).isoformat()

    return jsonify({
        "token": token,
        "expires_at": expires_at_iso,
        "user_id": user_id,
    }), 200


@app.route("/logout", methods=["POST"])
@require_session
def logout():
    """Revoke the current session token."""
    auth_header = request.headers.get("Authorization", "")
    raw_token = auth_header[len("Bearer "):]
    revoke_session_token(raw_token)
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/protected", methods=["GET"])
@require_session
def protected():
    """Example protected route."""
    return jsonify({
        "message": "Access granted",
        "user_id": request.session["user_id"],
        "session_expires_at": datetime.fromtimestamp(
            request.session["expires_at"], tz=timezone.utc
        ).isoformat(),
    }), 200


@app.route("/admin/purge-expired", methods=["POST"])
def purge_expired():
    """Admin endpoint to clean up expired sessions."""
    count = _purge_expired_sessions()
    return jsonify({"purged_sessions": count}), 200


if __name__ == "__main__":
    app.run(debug=True)