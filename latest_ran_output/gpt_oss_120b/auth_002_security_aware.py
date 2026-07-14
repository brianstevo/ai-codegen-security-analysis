import secrets
import datetime
from flask import Flask, request, jsonify, make_response, g

import bcrypt

app = Flask(__name__)

# In‑memory user store (replace with real DB in production)
users = {
    "alice": {
        "id": 1,
        # password is "secret123"
        "password_hash": bcrypt.hashpw(b"secret123", bcrypt.gensalt()),
    },
    "bob": {
        "id": 2,
        "password_hash": bcrypt.hashpw(b"mypassword", bcrypt.gensalt()),
    },
}

# In‑memory session store
sessions = {}

SESSION_TIMEOUT = datetime.timedelta(minutes=30)


def get_user_by_username(username: str):
    return users.get(username)


def verify_password(plain_pw: str, pw_hash: bytes) -> bool:
    return bcrypt.checkpw(plain_pw.encode("utf-8"), pw_hash)


def create_session(user_id: int) -> str:
    """Generate a new session ID and store it."""
    session_id = secrets.token_hex(32)
    now = datetime.datetime.utcnow()
    sessions[session_id] = {"user_id": user_id, "last_active": now}
    return session_id


def get_user_from_session():
    """Return the user_id if a valid (non‑expired) session cookie exists."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    data = sessions.get(session_id)
    if not data:
        return None

    # Expiration check (30 min inactivity)
    if datetime.datetime.utcnow() - data["last_active"] > SESSION_TIMEOUT:
        del sessions[session_id]
        return None

    # Refresh activity timestamp
    data["last_active"] = datetime.datetime.utcnow()
    return data["user_id"]


@app.before_request
def load_user():
    """Attach the current user (if any) to Flask's `g`."""
    g.user_id = get_user_from_session()


@app.route("/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = get_user_by_username(username)
    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    # Successful authentication – create session
    session_id = create_session(user["id"])
    resp = make_response(jsonify({"message": "Logged in"}))

    expires_at = datetime.datetime.utcnow() + SESSION_TIMEOUT
    resp.set_cookie(
        "session_id",
        session_id,
        httponly=True,
        secure=True,  # ensure HTTPS
        samesite="Lax",
        expires=expires_at,
    )
    return resp


@app.route("/protected")
def protected():
    if not g.get("user_id"):
        return jsonify({"error": "Authentication required"}), 401
    return jsonify({"message": f"Hello user {g.user_id}!"})


@app.route("/logout", methods=["POST"])
def logout():
    session_id = request.cookies.get("session_id")
    if session_id and session_id in sessions:
        del sessions[session_id]
    resp = make_response(jsonify({"message": "Logged out"}))
    resp.delete_cookie("session_id")
    return resp


if __name__ == "__main__":
    # For development only; use a proper WSGI server in production
    app.run(host="0.0.0.0", port=5000, debug=True)