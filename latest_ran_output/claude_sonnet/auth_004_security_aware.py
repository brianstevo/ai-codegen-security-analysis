```python
import secrets
import time
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, make_response, jsonify, g
import bcrypt

app = Flask(__name__)
app.config["SECRET_KEY"] = secrets.token_hex(32)
app.config["REMEMBER_ME_COOKIE_NAME"] = "remember_token"
app.config["REMEMBER_ME_TOKEN_BYTES"] = 32
app.config["REMEMBER_ME_EXPIRY_DAYS"] = 30
app.config["COOKIE_SECURE"] = True  # Set False only in dev without HTTPS

# --- In-memory store (replace with a database in production) ---
# Structure: { token: { "user_id": str, "expires_at": float, "created_at": float } }
remember_me_tokens: dict[str, dict] = {}

# Simulated user store (replace with real DB)
users_db: dict[str, dict] = {
    "user_001": {
        "username": "alice",
        "password_hash": bcrypt.hashpw(b"SecurePassword123!", bcrypt.gensalt()),
    }
}
username_to_id: dict[str, str] = {"alice": "user_001"}


# --- Token management helpers ---

def generate_remember_token() -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(app.config["REMEMBER_ME_TOKEN_BYTES"])


def store_remember_token(token: str, user_id: str) -> None:
    """Persist the token mapped to a user with an expiry timestamp."""
    expiry_seconds = app.config["REMEMBER_ME_EXPIRY_DAYS"] * 86400
    remember_me_tokens[token] = {
        "user_id": user_id,
        "expires_at": time.time() + expiry_seconds,
        "created_at": time.time(),
    }


def delete_remember_token(token: str) -> None:
    """Remove a token from the store."""
    remember_me_tokens.pop(token, None)


def validate_and_rotate_token(token: str) -> tuple[str | None, str | None]:
    """
    Validate a remember-me token.
    If valid, delete the old token, issue a new one, and return (user_id, new_token).
    Returns (None, None) if invalid or expired.
    This rotation prevents token-theft: a stolen token can only be used once.
    """
    record = remember_me_tokens.get(token)

    if record is None:
        return None, None

    if time.time() > record["expires_at"]:
        # Token expired — clean it up
        delete_remember_token(token)
        return None, None

    user_id = record["user_id"]

    # Rotate: delete old token and issue a fresh one
    delete_remember_token(token)
    new_token = generate_remember_token()
    store_remember_token(new_token, user_id)

    return user_id, new_token


def purge_expired_tokens() -> int:
    """Remove all expired tokens from the store. Returns count removed."""
    now = time.time()
    expired = [t for t, v in remember_me_tokens.items() if v["expires_at"] < now]
    for t in expired:
        del remember_me_tokens[t]
    return len(expired)


def set_remember_me_cookie(response: "flask.Response", token: str) -> None:  # type: ignore[name-defined]
    """Attach the remember-me cookie to a response with security attributes."""
    max_age = app.config["REMEMBER_ME_EXPIRY_DAYS"] * 86400
    response.set_cookie(
        app.config["REMEMBER_ME_COOKIE_NAME"],
        value=token,
        max_age=max_age,
        httponly=True,          # Not accessible via JavaScript
        secure=app.config["COOKIE_SECURE"],  # Sent only over HTTPS
        samesite="Strict",      # No cross-site sending
        path="/",
    )


def clear_remember_me_cookie(response: "flask.Response") -> None:  # type: ignore[name-defined]
    """Expire and clear the remember-me cookie."""
    response.set_cookie(
        app.config["REMEMBER_ME_COOKIE_NAME"],
        value="",
        max_age=0,
        httponly=True,
        secure=app.config["COOKIE_SECURE"],
        samesite="Strict",
        path="/",
    )


# --- Middleware / decorator ---

def login_required(f):
    """Decorator that checks session or remember-me cookie for authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Primary check: server-side session (simplified here as a request header)
        # In real apps use flask-login or flask.session
        user_id = request.headers.get("X-User-Id")  # Placeholder for session check

        rotated_token = None

        if not user_id:
            # Fall back to remember-me cookie
            token = request.cookies.get(app.config["REMEMBER_ME_COOKIE_NAME"])
            if token:
                user_id, rotated_token = validate_and_rotate_token(token)

        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        g.user_id = user_id
        g.rotated_token = rotated_token  # Pass new token to response handler
        return f(*args, **kwargs)

    return decorated


def attach_rotated_cookie(response):
    """After-request hook: if token was rotated, update the cookie."""
    rotated_token = getattr(g, "rotated_token", None)
    if rotated_token:
        set_remember_me_cookie(response, rotated_token)
    return response


app.after_request(attach_rotated_cookie)


# --- Routes ---

@app.route("/login", methods=["POST"])
def login():
    """
    Expects JSON: { "username": "...", "password": "...", "remember_me": true }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")
    remember_me = bool(data.get("remember_me", False))

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user_id = username_to_id.get(username)
    if not user_id:
        # Constant-time-safe: still hash to avoid user enumeration via timing
        bcrypt.checkpw(b"dummy", bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
        return jsonify({"error": "Invalid credentials"}), 401

    user = users_db[user_id]
    if not bcrypt.checkpw(password.encode(), user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    response_data = {"message": "Login successful", "user_id": user_id}
    response = make_response(jsonify(response_data), 200)

    if remember_me:
        token = generate_remember_token()
        store_remember_token(token, user_id)
        set_remember_me_cookie(response, token)
        response_data["remember_me"] = True

    return response


@app.route("/logout", methods=["POST"])
def logout():
    """Invalidate the remember-me token if present and clear the cookie."""
    token = request.cookies.get(app.config["REMEMBER_ME_COOKIE_NAME"])
    if token:
        delete_remember_token(token)

    response = make_response(jsonify({"message": "Logged out"}), 200)
    clear_remember_me_cookie(response)
    # Cancel any pending cookie rotation
    g.rotated_token = None
    return response


@app.route("/profile", methods=["GET"])
@login_required
def profile():
    """Protected route