import secrets
import time
from functools import wraps
from flask import Flask, request, jsonify, make_response, g

app = Flask(__name__)

# In-memory session store: { session_id: {"user_id": ..., "last_active": ...} }
SESSION_STORE = {}

SESSION_COOKIE_NAME = "session_id"
SESSION_INACTIVITY_TIMEOUT = 30 * 60  # 30 minutes in seconds


def create_user_session(user_id):
    """
    Create a new server-side session for the given user and return a Flask
    response with a secure, httponly session cookie set.

    The session ID is a cryptographically random value generated with
    secrets.token_hex. The session expires after 30 minutes of inactivity.
    """
    # Cryptographically secure random session identifier (256 bits).
    session_id = secrets.token_hex(32)

    now = time.time()
    SESSION_STORE[session_id] = {
        "user_id": user_id,
        "last_active": now,
    }

    response = make_response(jsonify({"message": "Login successful"}))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,                         # Not accessible via JavaScript
        secure=True,                           # Only sent over HTTPS
        samesite="Strict",                     # Mitigate CSRF
        max_age=SESSION_INACTIVITY_TIMEOUT,    # Cookie lifetime
    )
    return response


def get_valid_session(session_id):
    """
    Validate a session id. Returns the session record if valid and not
    expired (sliding 30-minute inactivity window), otherwise None.
    Expired sessions are removed from the store.
    """
    if not session_id:
        return None

    session = SESSION_STORE.get(session_id)
    if session is None:
        return None

    now = time.time()
    if now - session["last_active"] > SESSION_INACTIVITY_TIMEOUT:
        # Session expired due to inactivity.
        SESSION_STORE.pop(session_id, None)
        return None

    # Refresh inactivity timer (sliding expiration).
    session["last_active"] = now
    return session


def login_required(view):
    """
    Decorator that enforces a valid, non-expired session and refreshes the
    session cookie expiry on each authenticated request.
    """
    @wraps(view)
    def wrapper(*args, **kwargs):
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        session = get_valid_session(session_id)

        if session is None:
            return jsonify({"error": "Authentication required"}), 401

        g.user_id = session["user_id"]
        g.session_id = session_id

        result = view(*args, **kwargs)
        response = make_response(result)

        # Refresh the cookie so its max_age tracks the inactivity window.
        response.set_cookie(
            SESSION_COOKIE_NAME,
            session_id,
            httponly=True,
            secure=True,
            samesite="Strict",
            max_age=SESSION_INACTIVITY_TIMEOUT,
        )
        return response

    return wrapper


@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint. Replace authenticate_user with real credential
    verification (e.g. bcrypt password check against a database).
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    user_id = authenticate_user(username, password)
    if user_id is None:
        return jsonify({"error": "Invalid credentials"}), 401

    return create_user_session(user_id)


def authenticate_user(username, password):
    """
    Placeholder for real authentication logic. Should verify the password
    (e.g. using bcrypt.checkpw) and return a user id on success, else None.
    """
    # Implement actual credential verification here.
    return None


if __name__ == "__main__":
    # Use HTTPS in production so the 'secure' cookie flag is effective.
    app.run(ssl_context="adhoc")