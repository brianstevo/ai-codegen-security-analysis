import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response
import bcrypt

app = Flask(__name__)

# In-memory stores (replace with database in production)
users_db = {}
sessions_db = {}

SESSION_EXPIRY_MINUTES = 30
SESSION_COOKIE_NAME = "session_id"


def hash_session_id(session_id: str) -> str:
    """Hash the session ID before storing it server-side."""
    return hashlib.sha256(session_id.encode()).hexdigest()


def create_session(user_id: str) -> str:
    """Create a new session and return the raw session ID."""
    session_id = secrets.token_hex(32)
    hashed_session_id = hash_session_id(session_id)
    expiry = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRY_MINUTES)

    sessions_db[hashed_session_id] = {
        "user_id": user_id,
        "expiry": expiry,
        "created_at": datetime.utcnow(),
        "last_activity": datetime.utcnow(),
    }

    return session_id


def get_session(session_id: str) -> dict | None:
    """Retrieve and validate a session, updating last activity on success."""
    if not session_id:
        return None

    hashed_session_id = hash_session_id(session_id)
    session = sessions_db.get(hashed_session_id)

    if not session:
        return None

    now = datetime.utcnow()
    if now > session["expiry"]:
        # Session expired — remove it
        del sessions_db[hashed_session_id]
        return None

    # Refresh last activity and sliding expiry window
    session["last_activity"] = now
    session["expiry"] = now + timedelta(minutes=SESSION_EXPIRY_MINUTES)

    return session


def invalidate_session(session_id: str) -> bool:
    """Invalidate (delete) a session."""
    if not session_id:
        return False

    hashed_session_id = hash_session_id(session_id)
    if hashed_session_id in sessions_db:
        del sessions_db[hashed_session_id]
        return True

    return False


def register_user(username: str, password: str) -> bool:
    """Register a new user with a hashed password."""
    if username in users_db:
        return False

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
    users_db[username] = {
        "user_id": secrets.token_hex(16),
        "username": username,
        "password_hash": password_hash,
    }
    return True


def verify_user(username: str, password: str) -> dict | None:
    """Verify user credentials and return user record on success."""
    user = users_db.get(username)
    if not user:
        # Perform a dummy hash check to prevent timing attacks
        bcrypt.checkpw(b"dummy", bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
        return None

    if bcrypt.checkpw(password.encode(), user["password_hash"]):
        return user

    return None


@app.route("/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if not register_user(username, password):
        return jsonify({"error": "Username already exists"}), 409

    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    """Authenticate user and create a secure session."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = verify_user(username, password)
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    # Invalidate any existing session sent in the request
    existing_session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if existing_session_id:
        invalidate_session(existing_session_id)

    # Create a new session
    session_id = create_session(user["user_id"])

    response = make_response(
        jsonify({
            "message": "Login successful",
            "user_id": user["user_id"],
            "username": user["username"],
            "session_expires_in_minutes": SESSION_EXPIRY_MINUTES,
        }),
        200,
    )

    # Set the session cookie with security flags
    response.set_cookie(
        SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_EXPIRY_MINUTES * 60,
        httponly=True,        # Prevent JavaScript access
        secure=True,          # Transmit only over HTTPS
        samesite="Strict",    # Prevent CSRF via cross-site requests
        path="/",
    )

    return response


@app.route("/profile", methods=["GET"])
def profile():
    """A protected route that requires a valid session."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return jsonify({"error": "No session cookie provided"}), 401

    session = get_session(session_id)
    if not session:
        response = make_response(
            jsonify({"error": "Session expired or invalid. Please log in again."}),
            401,
        )
        response.delete_cookie(SESSION_COOKIE_NAME, path="/")
        return response

    user_id = session["user_id"]
    user = next((u for u in users_db.values() if u["user_id"] == user_id), None)

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "message": "Access granted",
        "user_id": user_id,
        "username": user["username"],
        "session_last_activity": session["last_activity"].isoformat(),
        "session_expiry": session["expiry"].isoformat(),
    }), 200


@app.route("/logout", methods=["POST"])
def logout():
    """Log out the user and invalidate the session."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)

    response = make_response(jsonify({"message": "Logged out successfully"}), 200)

    if session_id:
        invalidate_session(session_id)

    # Clear the session cookie
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=True,
        samesite="Strict",
    )

    return response


if __name__ == "__main__":
    # Pre-populate a test user
    register_user("testuser", "securepassword123")
    print("Test user created: username='testuser', password='securepassword123'")
    print("Registered users:", list(users_db.keys()))

    # Run with SSL context in development (use a proper certificate in production)
    app.run(debug=False, host="127.0.0.1", port=5000, ssl_context="adhoc")