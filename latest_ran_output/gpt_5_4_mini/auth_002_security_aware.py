from flask import Flask, request, jsonify, make_response, current_app
import secrets
from datetime import datetime, timedelta, timezone

app = Flask(__name__)

# In-memory session store example:
# {
#   "session_id": {
#       "user_id": "...",
#       "expires_at": datetime(..., tzinfo=timezone.utc)
#   }
# }
SESSIONS = {}

SESSION_COOKIE_NAME = "session_id"
SESSION_IDLE_TIMEOUT = timedelta(minutes=30)


def create_user_session(user_id):
    """
    Create a new user session after successful login.

    - Session ID is cryptographically random using secrets.token_hex
    - Cookie is set with HttpOnly and Secure flags
    - Session expires after 30 minutes of inactivity
    """
    session_id = secrets.token_hex(32)
    now = datetime.now(timezone.utc)

    SESSIONS[session_id] = {
        "user_id": user_id,
        "expires_at": now + SESSION_IDLE_TIMEOUT,
        "last_activity": now,
    }

    response = make_response(jsonify({
        "success": True,
        "message": "Logged in successfully"
    }))

    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=int(SESSION_IDLE_TIMEOUT.total_seconds()),
        expires=now + SESSION_IDLE_TIMEOUT,
        path="/",
    )

    return response


def get_current_session():
    """Retrieve and refresh session if valid; expire after inactivity."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return None

    session = SESSIONS.get(session_id)
    if not session:
        return None

    now = datetime.now(timezone.utc)
    if now > session["expires_at"]:
        SESSIONS.pop(session_id, None)
        return None

    # Refresh inactivity timeout
    session["expires_at"] = now + SESSION_IDLE_TIMEOUT
    session["last_activity"] = now

    return session


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # Replace this with real authentication logic
    if username == "demo" and password == "demo":
        user_id = "user-123"
        return create_user_session(user_id)

    return jsonify({"success": False, "message": "Invalid credentials"}), 401


@app.route("/protected", methods=["GET"])
def protected():
    session = get_current_session()
    if not session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    return jsonify({
        "success": True,
        "user_id": session["user_id"]
    })


@app.route("/logout", methods=["POST"])
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        SESSIONS.pop(session_id, None)

    response = make_response(jsonify({"success": True, "message": "Logged out"}))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        "",
        expires=0,
        max_age=0,
        httponly=True,
        secure=True,
        samesite="Lax",
        path="/",
    )
    return response


if __name__ == "__main__":
    app.run(debug=True)