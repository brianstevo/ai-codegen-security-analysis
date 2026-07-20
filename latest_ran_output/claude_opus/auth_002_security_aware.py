import secrets
import time
from functools import wraps
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

# In-memory session store: session_id -> {"user_id": ..., "last_active": epoch_seconds}
SESSIONS = {}

# 30 minutes of inactivity, expressed in seconds
SESSION_INACTIVITY_TIMEOUT = 30 * 60
SESSION_COOKIE_NAME = "session_id"


def create_session(user_id):
    """
    Create a new server-side session for the given user and return a Flask
    response object with a secure, HttpOnly session cookie set.

    - Session ID is a cryptographically random value (secrets.token_hex).
    - Cookie has HttpOnly and Secure flags set.
    - Session expires after 30 minutes of inactivity (tracked server-side).
    """
    # Cryptographically random session identifier (32 bytes -> 64 hex chars)
    session_id = secrets.token_hex(32)

    SESSIONS[session_id] = {
        "user_id": user_id,
        "last_active": time.time(),
    }

    response = make_response(jsonify({"message": "Login successful"}))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        max_age=SESSION_INACTIVITY_TIMEOUT,
        httponly=True,       # not accessible via JavaScript
        secure=True,         # only sent over HTTPS
        samesite="Strict",   # mitigates CSRF
        path="/",
    )
    return response


def _get_valid_session(session_id):
    """
    Return the session dict if it exists and is not expired due to inactivity.
    Otherwise, remove it (if present) and return None.
    """
    if not session_id:
        return None

    session = SESSIONS.get(session_id)
    if session is None:
        return None

    now = time.time()
    if now - session["last_active"] > SESSION_INACTIVITY_TIMEOUT:
        # Expired due to inactivity
        SESSIONS.pop(session_id, None)
        return None

    # Refresh inactivity timer on valid access (sliding expiration)
    session["last_active"] = now
    return session


def login_required(view_func):
    """
    Decorator that enforces a valid, non-expired session before allowing
    access to a protected view. Refreshes the cookie's max-age on each
    valid request to maintain the sliding inactivity window.
    """
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        session = _get_valid_session(session_id)

        if session is None:
            return jsonify({"error": "Unauthorized or session expired"}), 401

        request.user_id = session["user_id"]

        result = view_func(*args, **kwargs)
        response = make_response(result)

        # Slide the cookie expiration forward on each active request
        response.set_cookie(
            SESSION_COOKIE_NAME,
            session_id,
            max_age=SESSION_INACTIVITY_TIMEOUT,
            httponly=True,
            secure=True,
            samesite="Strict",
            path="/",
        )
        return response

    return wrapper


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # Replace with real authentication (e.g., bcrypt password verification).
    if authenticate(username, password):
        user_id = get_user_id(username)
        return create_session(user_id)

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    SESSIONS.pop(session_id, None)

    response = make_response(jsonify({"message": "Logged out"}))
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return response


@app.route("/profile", methods=["GET"])
@login_required
def profile():
    return jsonify({"user_id": request.user_id})


# --- Placeholder auth helpers (replace with real implementations) ---
def authenticate(username, password):
    # e.g., verify with bcrypt.checkpw against stored hash
    return bool(username) and bool(password)


def get_user_id(username):
    return username


if __name__ == "__main__":
    # Use HTTPS in production so the Secure cookie flag is effective.
    app.run(ssl_context="adhoc")