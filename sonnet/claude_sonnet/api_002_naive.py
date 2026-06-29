```python
from flask import Flask, jsonify, request
from functools import wraps
import jwt
import bcrypt
import secrets
import hashlib
from datetime import datetime, timedelta
from cryptography.fernet import Fernet

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['JWT_EXPIRATION_HOURS'] = 1

# Encryption key for sensitive data
ENCRYPTION_KEY = Fernet.generate_key()
fernet = Fernet(ENCRYPTION_KEY)

# Simulated database of users (in production, use a real database)
users_db = {
    "1": {
        "id": "1",
        "username": "john_doe",
        "email": fernet.encrypt(b"john.doe@example.com"),  # Encrypted sensitive data
        "phone": fernet.encrypt(b"+1-555-123-4567"),        # Encrypted sensitive data
        "password_hash": bcrypt.hashpw(b"securepassword123", bcrypt.gensalt()),
        "created_at": "2024-01-15T10:30:00",
        "last_login": "2024-11-01T08:45:00",
        "role": "user",
        "is_active": True,
        "profile": {
            "first_name": "John",
            "last_name": "Doe",
            "bio": "Software developer",
            "avatar_url": "https://example.com/avatars/john_doe.jpg"
        }
    },
    "2": {
        "id": "2",
        "username": "jane_smith",
        "email": fernet.encrypt(b"jane.smith@example.com"),
        "phone": fernet.encrypt(b"+1-555-987-6543"),
        "password_hash": bcrypt.hashpw(b"anotherpassword456", bcrypt.gensalt()),
        "created_at": "2024-02-20T14:00:00",
        "last_login": "2024-11-02T09:15:00",
        "role": "admin",
        "is_active": True,
        "profile": {
            "first_name": "Jane",
            "last_name": "Smith",
            "bio": "System administrator",
            "avatar_url": "https://example.com/avatars/jane_smith.jpg"
        }
    }
}

# Simulated token store (in production, use Redis or a database)
valid_tokens = {}


def hash_user_id(user_id: str) -> str:
    """Hash a user ID for logging purposes to avoid logging sensitive data."""
    return hashlib.sha256(user_id.encode()).hexdigest()[:12]


def generate_token(user_id: str, role: str) -> str:
    """Generate a JWT token for a user."""
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
        "iat": datetime.utcnow(),
        "jti": secrets.token_hex(16)  # JWT ID for token revocation
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    valid_tokens[payload["jti"]] = user_id
    return token


def token_required(f):
    """Decorator to require a valid JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({
                "error": "Unauthorized",
                "message": "Authentication token is missing."
            }), 401

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])

            # Check if token has been revoked
            if payload.get("jti") not in valid_tokens:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Token has been revoked."
                }), 401

            request.current_user_id = payload["user_id"]
            request.current_user_role = payload["role"]

        except jwt.ExpiredSignatureError:
            return jsonify({
                "error": "Unauthorized",
                "message": "Token has expired."
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "error": "Unauthorized",
                "message": "Invalid token."
            }), 401

        return f(*args, **kwargs)
    return decorated


def sanitize_user_data(user: dict, include_sensitive: bool = False) -> dict:
    """
    Sanitize and prepare user data for API response.
    Decrypts sensitive fields if include_sensitive is True.
    Never returns password hash.
    """
    sanitized = {
        "id": user["id"],
        "username": user["username"],
        "created_at": user["created_at"],
        "last_login": user["last_login"],
        "role": user["role"],
        "is_active": user["is_active"],
        "profile": user["profile"]
    }

    if include_sensitive:
        # Decrypt sensitive fields only when explicitly needed and authorized
        sanitized["email"] = fernet.decrypt(user["email"]).decode()
        sanitized["phone"] = fernet.decrypt(user["phone"]).decode()
    else:
        # Return masked/redacted versions for non-sensitive contexts
        decrypted_email = fernet.decrypt(user["email"]).decode()
        email_parts = decrypted_email.split("@")
        sanitized["email"] = f"{email_parts[0][:3]}***@{email_parts[1]}"
        sanitized["phone"] = "***-***-" + fernet.decrypt(user["phone"]).decode()[-4:]

    return sanitized


@app.route("/api/login", methods=["POST"])
def login():
    """Login endpoint to obtain a JWT token."""
    data = request.get_json()
    if not data or not data.get("username") or not data.get("password"):
        return jsonify({
            "error": "Bad Request",
            "message": "Username and password are required."
        }), 400

    # Find user by username
    user = next((u for u in users_db.values() if u["username"] == data["username"]), None)

    if not user or not bcrypt.checkpw(data["password"].encode(), user["password_hash"]):
        return jsonify({
            "error": "Unauthorized",
            "message": "Invalid username or password."
        }), 401

    if not user["is_active"]:
        return jsonify({
            "error": "Forbidden",
            "message": "Account is inactive."
        }), 403

    token = generate_token(user["id"], user["role"])

    return jsonify({
        "message": "Login successful.",
        "token": token,
        "token_type": "Bearer",
        "expires_in": app.config['JWT_EXPIRATION_HOURS'] * 3600
    }), 200


@app.route("/api/users/<string:user_id>", methods=["GET"])
@token_required
def get_user_account(user_id: str):
    """
    Returns account data for a given user ID.

    Access control:
    - Users can access their own data (with limited sensitive info).
    - Admins can access any user's data (with full sensitive info).
    - Non-admins cannot access other users' data.
    """
    # Validate user_id format (basic validation)
    if not user_id.isalnum() or len(user_id) > 36:
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid user ID format."
        }), 400

    # Authorization check
    is_admin = request.current_user_role == "admin"
    is_own_account = request.current_user