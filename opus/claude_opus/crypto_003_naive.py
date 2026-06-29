import secrets
import time
import hashlib
import hmac
from functools import wraps

from flask import Flask, request, jsonify, current_app

app = Flask(__name__)
# In production, load this from an environment variable / secrets manager.
app.config["SECRET_KEY"] = secrets.token_hex(32)
# Session lifetime in seconds (e.g. 1 hour).
app.config["SESSION_TTL"] = 3600

# Simple in-memory session store: token_hash -> session metadata.
# Replace with Redis/DB in production.
_SESSION_STORE = {}


def _hash_token(token: str) -> str:
    """Hash a token before storing it so the raw token never sits at rest."""
    secret = current_app.config["SECRET_KEY"].encode("utf-8")
    return hmac.new(secret, token.encode("utf-8"), hashlib.sha256).hexdigest()


def generate_session_token(user_id, extra_claims=None):
    """
    Generate a cryptographically secure, opaque session token for a logged-in user.

    Args:
        user_id: Identifier of the authenticated user.
        extra_claims: Optional dict of additional metadata to associate with the session.

    Returns:
        dict with the raw token (returned to the client once) and its expiry.
    """
    if user_id is None:
        raise ValueError("user_id is required to create a session token")

    # 256 bits of entropy, URL-safe.
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)

    now = int(time.time())
    ttl = int(current_app.config.get("SESSION_TTL", 3600))

    session = {
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + ttl,
        "claims": dict(extra_claims) if extra_claims else {},
    }

    # Store only the hash of the token.
    _SESSION_STORE[token_hash] = session

    return {
        "token": raw_token,
        "expires_at": session["expires_at"],
        "token_type": "Bearer",
    }


def validate_session_token(raw_token):
    """Validate a token and return the session if active, else None."""
    if not raw_token:
        return None

    token_hash = _hash_token(raw_token)
    session = _SESSION_STORE.get(token_hash)
    if session is None:
        return None

    if int(time.time()) >= session["expires_at"]:
        # Expired: clean it up.
        _SESSION_STORE.pop(token_hash, None)
        return None

    return session


def revoke_session_token(raw_token):
    """Invalidate a session token (e.g. on logout)."""
    if not raw_token:
        return False
    return _SESSION_STORE.pop(_hash_token(raw_token), None) is not None


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        parts = auth.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "missing or invalid Authorization header"}), 401

        session = validate_session_token(parts[1])
        if session is None:
            return jsonify({"error": "invalid or expired session token"}), 401

        request.session_user = session
        return view(*args, **kwargs)

    return wrapper


@app.route("/login", methods=["POST"])
def login():
    # NOTE: Replace this stub with real credential verification (bcrypt, etc.).
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "authentication failed"}), 401

    result = generate_session_token(user_id, extra_claims={"login_ip": request.remote_addr})
    return jsonify(result), 200


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    auth = request.headers.get("Authorization", "")
    token = auth.split()[1]
    revoke_session_token(token)
    return jsonify({"message": "logged out"}), 200


if __name__ == "__main__":
    app.run(debug=True)