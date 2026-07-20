```python
import secrets
import datetime
from flask import Flask, request, jsonify, make_response
import bcrypt

app = Flask(__name__)

# In-memory stores (replace with a database in production)
users_db = {}
sessions_db = {}

SESSION_EXPIRY_MINUTES = 30


def create_user(username: str, password: str) -> dict:
    """Helper to create a user with hashed password."""
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    user = {
        "username": username,
        "password_hash": hashed_password,
        "created_at": datetime.datetime.utcnow(),
    }
    users_db[username] = user
    return user


def create_session(username: str) -> str:
    """Create a new session for the given username."""
    session_id = secrets.token_hex(32)
    now = datetime.datetime.utcnow()
    sessions_db[session_id] = {
        "username": username,
        "created_at": now,
        "last_activity": now,
        "expires_at": now + datetime.timedelta(minutes=SESSION_EXPIRY_MINUTES),
    }
    return session_id


def get_session(session_id: str) -> dict | None:
    """Retrieve and validate a session, updating last activity if valid."""
    if not session_id or session_id not in sessions_db:
        return None

    session = sessions_db[session_id]
    now = datetime.datetime.utcnow()

    # Check if session has expired
    if now > session["expires_at"]:
        delete_session(session_id)
        return None

    # Update last activity and extend expiry on each valid access
    session["last_activity"] = now
    session["expires_at"] = now + datetime.timedelta(minutes=SESSION_EXPIRY_MINUTES)

    return session


def delete_session(session_id: str) -> bool:
    """Delete a session by ID."""
    if session_id in sessions_db:
        del sessions_db[session_id]
        return True
    return False


def cleanup_expired_sessions():
    """Remove all expired sessions from the store."""
    now = datetime.datetime.utcnow()
    expired_ids = [
        sid for sid, session in sessions_db.items() if now > session["expires_at"]
    ]
    for sid in expired_ids:
        del sessions_db[sid]
    return len(expired_ids)


def set_session_cookie(response, session_id: str, expires_at: datetime.datetime):
    """Set the session cookie with security flags."""
    response.set_cookie(
        "session_id",
        value=session_id,
        expires=expires_at,
        httponly=True,   # Prevent JavaScript access
        secure=True,     # Only send over HTTPS
        samesite="Strict",  # Prevent CSRF
        path="/",
    )
    return response


@app.route("/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json()

    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password are required"}), 400

    username = data["username"].strip()
    password = data["password"]

    if not username or not password:
        return jsonify({"error": "Username and password cannot be empty"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if username in users_db:
        return jsonify({"error": "Username already exists"}), 409

    create_user(username, password)
    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    """Authenticate user and create a session."""
    data = request.get_json()

    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password are required"}), 400

    username = data["username"].strip()
    password = data["password"]

    # Validate credentials
    user = users_db.get(username)
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "Invalid username or password"}), 401

    # Invalidate any existing session for this user
    existing_sessions = [
        sid for sid, s in sessions_db.items() if s["username"] == username
    ]
    for sid in existing_sessions:
        delete_session(sid)

    # Create new session
    session_id = create_session(username)
    session = sessions_db[session_id]

    response = make_response(
        jsonify({
            "message": "Login successful",
            "username": username,
            "session_expires_at": session["expires_at"].isoformat() + "Z",
        }),
        200,
    )

    # Set secure session cookie
    set_session_cookie(response, session_id, session["expires_at"])

    return response


@app.route("/logout", methods=["POST"])
def logout():
    """Invalidate the current session."""
    session_id = request.cookies.get("session_id")

    if not session_id or not get_session(session_id):
        return jsonify({"error": "No active session found"}), 401

    delete_session(session_id)

    response = make_response(jsonify({"message": "Logged out successfully"}), 200)
    # Clear the session cookie
    response.set_cookie(
        "session_id",
        value="",
        expires=0,
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )
    return response


@app.route("/protected", methods=["GET"])
def protected_route():
    """Example protected route requiring a valid session."""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id) if session_id else None

    if not session:
        return jsonify({"error": "Unauthorized: valid session required"}), 401

    response = make_response(
        jsonify({
            "message": f"Hello, {session['username']}! This is a protected resource.",
            "session_expires_at": session["expires_at"].isoformat() + "Z",
        }),
        200,
    )

    # Refresh the session cookie with updated expiry
    set_session_cookie(response, session_id, session["expires_at"])

    return response


@app.route("/session/status", methods=["GET"])
def session_status():
    """Check the status of the current session."""
    session_id = request.cookies.get("session_id")
    session = get_session(session_id) if session_id else None

    if not session:
        return jsonify({"active": False, "message": "No active session"}), 200

    return jsonify({
        "active": True,
        "username": session["username"],
        "last_activity": session["last_activity"].isoformat() + "Z",
        "expires_at": session["expires_at"].isoformat() + "Z",
        "minutes_remaining": round(
            (session["expires_at"] - datetime.datetime.utcnow()).total_seconds() / 60, 2
        ),
    }), 200


@app.route("/admin/cleanup", methods=["POST"])
def admin_cleanup():
    """Clean up expired sessions (admin endpoint)."""
    removed = cleanup_expired_sessions()
    return jsonify({
        "message": f"Cleaned up {removed} expired session(s)",
        "active_sessions": len(sessions_db),
    }), 200


if __name__ == "__main__":
    # Seed a test user
    create_user("testuser", "securepassword123")
    print("Test user created: username='testuser', password='securepassword123'")

    # Run with SSL context for secure cookies in development
    # In production, use a proper WSGI server with TLS termination
    app.