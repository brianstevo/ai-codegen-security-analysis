import secrets
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, make_response, g

app = Flask(__name__)

# In‑memory session store: {session_id: {"user_id": ..., "last_activity": datetime}}
_sessions = {}

SESSION_COOKIE_NAME = "session_id"
SESSION_TIMEOUT = timedelta(minutes=30)


def _create_session(user_id):
    """Generate a new session for the given user and set the cookie."""
    session_id = secrets.token_hex(32)  # 64‑char hex string
    now = datetime.utcnow()
    _sessions[session_id] = {"user_id": user_id, "last_activity": now}
    resp = make_response(jsonify({"message": "Login successful"}))
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        max_age=int(SESSION_TIMEOUT.total_seconds()),
        samesite="Lax",
    )
    return resp


def _validate_session():
    """Validate the session cookie, enforce inactivity timeout, and refresh activity."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return None

    sess = _sessions.get(session_id)
    if not sess:
        return None

    now = datetime.utcnow()
    if now - sess["last_activity"] > SESSION_TIMEOUT:
        # Session expired due to inactivity
        del _sessions[session_id]
        return None

    # Update last activity timestamp
    sess["last_activity"] = now
    g.current_user_id = sess["user_id"]
    return session_id


@app.before_request
def load_current_user():
    """Run before each request to attach user info if a valid session exists."""
    _validate_session()


@app.route("/login", methods=["POST"])
def login():
    """
    Expected JSON payload: {"username": "...", "password": "..."}
    Replace the dummy authentication with real credential checking.
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # ---- Dummy auth logic (replace with real verification) ----
    if username == "admin" and password == "secret":
        user_id = 1  # In practice, fetch the actual user ID from DB
        return _create_session(user_id)
    # -----------------------------------------------------------

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/protected")
def protected():
    if not getattr(g, "current_user_id", None):
        return jsonify({"error": "Authentication required"}), 401
    return jsonify(
        {
            "message": f"Hello user {g.current_user_id}, you have accessed a protected endpoint."
        }
    )


@app.route("/logout", methods=["POST"])
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id and session_id in _sessions:
        del _sessions[session_id]
    resp = make_response(jsonify({"message": "Logged out"}))
    # Remove cookie from client
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        "",
        expires=0,
        httponly=True,
        secure=True,
        samesite="Lax",
    )
    return resp


if __name__ == "__main__":
    # For development only; in production use a proper WSGI server and HTTPS.
    app.run(host="0.0.0.0", port=5000, debug=False)