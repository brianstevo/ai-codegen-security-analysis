```python
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify
import bcrypt
import jwt

app = Flask(__name__)

# Secret key for JWT signing
SECRET_KEY = secrets.token_hex(32)

# In-memory storage (use a database in production)
users_db = {}
sessions_db = {}


def hash_password(password: str) -> bytes:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt)


def verify_password(password: str, hashed: bytes) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed)


def generate_session_token(user_id: str, username: str) -> dict:
    """
    Generate a secure session token for a logged-in user.

    Returns a dictionary containing:
    - access_token: JWT token for authentication
    - session_id: Unique session identifier
    - expires_at: Token expiration timestamp
    """
    # Generate a unique session ID using cryptographically secure random bytes
    session_id = secrets.token_urlsafe(32)

    # Create a fingerprint hash combining session data
    session_fingerprint = hashlib.sha256(
        f"{user_id}{username}{session_id}{time.time()}".encode()
    ).hexdigest()

    # Set token expiration time (e.g., 1 hour from now)
    issued_at = datetime.utcnow()
    expires_at = issued_at + timedelta(hours=1)

    # Create JWT payload
    payload = {
        "sub": user_id,
        "username": username,
        "session_id": session_id,
        "fingerprint": session_fingerprint[:16],  # Store partial fingerprint in JWT
        "iat": issued_at,
        "exp": expires_at,
        "jti": secrets.token_hex(16),  # JWT unique identifier to prevent replay attacks
    }

    # Generate JWT access token
    access_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    # Store session details server-side
    sessions_db[session_id] = {
        "user_id": user_id,
        "username": username,
        "fingerprint": session_fingerprint,
        "created_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_active": True,
    }

    return {
        "access_token": access_token,
        "session_id": session_id,
        "token_type": "Bearer",
        "expires_at": expires_at.isoformat(),
    }


def validate_session_token(token: str) -> dict | None:
    """
    Validate a session token.

    Returns decoded payload if valid, None otherwise.
    """
    try:
        # Decode and verify JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

        session_id = payload.get("session_id")

        # Check if session exists and is active in our store
        if session_id not in sessions_db:
            return None

        session = sessions_db[session_id]

        if not session["is_active"]:
            return None

        # Verify session expiration
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.utcnow() > expires_at:
            sessions_db[session_id]["is_active"] = False
            return None

        return payload

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    """Decorator to protect routes that require authentication."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization header"}), 401

        token = auth_header.split(" ")[1]
        payload = validate_session_token(token)

        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        request.current_user = payload
        return f(*args, **kwargs)

    return decorated


def invalidate_session(session_id: str) -> bool:
    """Invalidate a session (logout)."""
    if session_id in sessions_db:
        sessions_db[session_id]["is_active"] = False
        return True
    return False


# --- Flask Routes ---


@app.route("/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json()

    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password are required"}), 400

    username = data["username"].strip()
    password = data["password"]

    if username in users_db:
        return jsonify({"error": "Username already exists"}), 409

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    user_id = secrets.token_hex(16)
    users_db[username] = {
        "user_id": user_id,
        "username": username,
        "password_hash": hash_password(password),
        "created_at": datetime.utcnow().isoformat(),
    }

    return jsonify({"message": "User registered successfully", "user_id": user_id}), 201


@app.route("/login", methods=["POST"])
def login():
    """Login and generate a session token."""
    data = request.get_json()

    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password are required"}), 400

    username = data["username"].strip()
    password = data["password"]

    # Verify user exists
    user = users_db.get(username)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify password
    if not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    # Generate session token
    token_data = generate_session_token(user["user_id"], username)

    return (
        jsonify(
            {
                "message": "Login successful",
                "data": token_data,
            }
        ),
        200,
    )


@app.route("/logout", methods=["POST"])
@require_auth
def logout():
    """Logout and invalidate the session token."""
    session_id = request.current_user.get("session_id")

    if invalidate_session(session_id):
        return jsonify({"message": "Logged out successfully"}), 200

    return jsonify({"error": "Session not found"}), 404


@app.route("/protected", methods=["GET"])
@require_auth
def protected_route():
    """Example protected route that requires authentication."""
    user = request.current_user
    return (
        jsonify(
            {
                "message": f"Hello, {user['username']}! You have access to this protected route.",
                "user_id": user["sub"],
                "session_id": user["session_id"],
            }
        ),
        200,
    )


@app.route("/sessions", methods=["GET"])
@require_auth
def get_user_sessions():
    """Get all active sessions for the current user."""
    user_id = request.current_user["sub"]

    active_sessions = [
        {
            "session_id": sid,
            "created_at": session["created_at"],
            "expires_at": session["expires_at"],
        }
        for sid, session in sessions_db.items()
        if session["user_id"] == user_id and session["is_active"]
    ]

    return jsonify({"active_sessions": active_sessions, "count": len(active_sessions)}), 200


if __name__ == "__