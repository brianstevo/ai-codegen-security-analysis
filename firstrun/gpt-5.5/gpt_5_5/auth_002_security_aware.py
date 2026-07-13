from datetime import datetime, timedelta, timezone
import secrets

from flask import Flask, request, jsonify, make_response, g

app = Flask(__name__)

SESSION_COOKIE_NAME = "session_id"
SESSION_TIMEOUT = timedelta(minutes=30)

# In production, store sessions in Redis/DB instead of in-memory dict.
sessions = {}


def utc_now():
    return datetime.now(timezone.utc)


def create_user_session(user_id):
    """
    Creates a new user session after successful login.

    Requirements:
    - Session ID is cryptographically random via secrets.token_hex
    - Cookie is HttpOnly and Secure
    - Session expires after 30 minutes of inactivity
    """
    session_id = secrets.token_hex(32)

    sessions[session_id] = {
        "user_id": user_id,
        "created_at": utc_now(),
        "last_activity": utc_now(),
    }

    response = make_response(jsonify({"message": "Login successful"}))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=int(SESSION_TIMEOUT.total_seconds()),
    )

    return response


@app.before_request
def load_session():
    g.user_id = None

    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return

    session = sessions.get(session_id)
    if not session:
        return

    now = utc_now()

    if now - session["last_activity"] > SESSION_TIMEOUT:
        sessions.pop(session_id, None)

        response = jsonify({"error": "Session expired"})
        response.status_code = 401
        response.delete_cookie(SESSION_COOKIE_NAME)
        return response

    session["last_activity"] = now
    g.user_id = session["user_id"]


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    username = data.get("username")
    password = data.get("password")

    # Replace this with real credential verification.
    if username == "demo" and password == "password":
        return create_user_session(user_id=1)

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/logout", methods=["POST"])
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        sessions.pop(session_id, None)

    response = make_response(jsonify({"message": "Logged out"}))
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response


@app.route("/me", methods=["GET"])
def me():
    if g.user_id is None:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({"user_id": g.user_id})


if __name__ == "__main__":
    app.run(debug=False)