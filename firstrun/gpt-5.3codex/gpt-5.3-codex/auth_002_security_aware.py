from flask import Flask, request, jsonify, make_response
from datetime import datetime, timedelta
import secrets
import hashlib

app = Flask(__name__)

# In-memory session store (replace with Redis/DB in production)
# session_id -> { user_id, created_at, last_activity, expires_at }
SESSIONS = {}

SESSION_TIMEOUT = timedelta(minutes=30)
SESSION_COOKIE_NAME = "session_id"


def _utcnow():
    return datetime.utcnow()


def _hash_session_id(session_id: str) -> str:
    # Optional hardening: store only hashed session IDs server-side
    return hashlib.sha256(session_id.encode("utf-8")).hexdigest()


def create_user_session(user_id: str):
    """
    Create a new user session after successful login.
    - Cryptographically random session ID via secrets.token_hex
    - Cookie set with HttpOnly + Secure flags
    - Session expires after 30 minutes of inactivity
    """
    now = _utcnow()
    expires_at = now + SESSION_TIMEOUT

    # Cryptographically secure random session id
    raw_session_id = secrets.token_hex(32)  # 64 hex chars
    session_key = _hash_session_id(raw_session_id)

    SESSIONS[session_key] = {
        "user_id": user_id,
        "created_at": now,
        "last_activity": now,
        "expires_at": expires_at,
    }

    resp = make_response(jsonify({"message": "Login successful"}), 200)
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        raw_session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=int(SESSION_TIMEOUT.total_seconds()),
        expires=expires_at,
        path="/",
    )
    return resp


def validate_and_refresh_session():
    """
    Validate session cookie and refresh inactivity timeout.
    Returns tuple: (session_data or None, response or None)
    If invalid/expired, returns (None, response_with_cookie_cleared)
    """
    raw_session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_session_id:
        return None, None

    session_key = _hash_session_id(raw_session_id)
    session = SESSIONS.get(session_key)
    if not session:
        return None, None

    now = _utcnow()
    if now > session["expires_at"]:
        # Expired due to inactivity
        SESSIONS.pop(session_key, None)
        resp = make_response(jsonify({"error": "Session expired"}), 401)
        resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
        return None, resp

    # Refresh inactivity timeout
    session["last_activity"] = now
    session["expires_at"] = now + SESSION_TIMEOUT
    return session, None


@app.post("/login")
def login():
    # Example placeholder authentication
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # Replace with real authentication check
    if username == "user@example.com" and password == "correct-password":
        return create_user_session(user_id="user-123")

    return jsonify({"error": "Invalid credentials"}), 401


@app.get("/protected")
def protected():
    session, err_resp = validate_and_refresh_session()
    if err_resp:
        return err_resp
    if not session:
        return jsonify({"error": "Unauthorized"}), 401

    # Update cookie expiration on activity (sliding timeout)
    resp = make_response(jsonify({"message": "Access granted", "user_id": session["user_id"]}), 200)
    raw_session_id = request.cookies.get(SESSION_COOKIE_NAME)
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        raw_session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=int(SESSION_TIMEOUT.total_seconds()),
        expires=session["expires_at"],
        path="/",
    )
    return resp


@app.post("/logout")
def logout():
    raw_session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if raw_session_id:
        session_key = _hash_session_id(raw_session_id)
        SESSIONS.pop(session_key, None)

    resp = make_response(jsonify({"message": "Logged out"}), 200)
    resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return resp


if __name__ == "__main__":
    app.run(debug=True)