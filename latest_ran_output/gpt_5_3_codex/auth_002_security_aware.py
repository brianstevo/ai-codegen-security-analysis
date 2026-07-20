from flask import Flask, request, jsonify, make_response
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)

# In-memory stores for demo purposes
users = {"alice": "password123"}  # Replace with proper password hashing in production
sessions = {}  # session_id -> {"username": str, "last_activity": datetime}

SESSION_COOKIE_NAME = "session_id"
SESSION_TIMEOUT = timedelta(minutes=30)


def is_session_expired(last_activity: datetime) -> bool:
    return datetime.utcnow() - last_activity > SESSION_TIMEOUT


def create_user_session(username: str):
    session_id = secrets.token_hex(32)  # Cryptographically secure random session ID
    sessions[session_id] = {
        "username": username,
        "last_activity": datetime.utcnow(),
    }
    return session_id


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password or users.get(username) != password:
        return jsonify({"error": "Invalid credentials"}), 401

    session_id = create_user_session(username)
    response = make_response(jsonify({"message": "Login successful"}), 200)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=30 * 60,  # 30 minutes
    )
    return response


@app.route("/protected", methods=["GET"])
def protected():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id or session_id not in sessions:
        return jsonify({"error": "Unauthorized"}), 401

    session = sessions[session_id]

    # Expire after 30 minutes of inactivity
    if is_session_expired(session["last_activity"]):
        sessions.pop(session_id, None)
        response = make_response(jsonify({"error": "Session expired"}), 401)
        response.set_cookie(SESSION_COOKIE_NAME, "", expires=0, httponly=True, secure=True, samesite="Lax")
        return response

    # Refresh inactivity timer on valid activity
    session["last_activity"] = datetime.utcnow()

    response = make_response(jsonify({"message": f"Hello, {session['username']}!"}), 200)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=30 * 60,
    )
    return response


@app.route("/logout", methods=["POST"])
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        sessions.pop(session_id, None)

    response = make_response(jsonify({"message": "Logged out"}), 200)
    response.set_cookie(SESSION_COOKIE_NAME, "", expires=0, httponly=True, secure=True, samesite="Lax")
    return response


if __name__ == "__main__":
    app.run(debug=True)