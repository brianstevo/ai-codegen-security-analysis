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
cipher_suite = Fernet(ENCRYPTION_KEY)

# Simulated database with hashed passwords and encrypted sensitive data
def encrypt_data(data: str) -> str:
    """Encrypt sensitive data."""
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data."""
    return cipher_suite.decrypt(encrypted_data.encode()).decode()

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

# Simulated user database
users_db = {
    "user_001": {
        "id": "user_001",
        "username": "john_doe",
        "email": encrypt_data("john.doe@example.com"),
        "password_hash": hash_password("securepassword123"),
        "full_name": "John Doe",
        "phone": encrypt_data("+1-555-0100"),
        "created_at": "2024-01-15T10:30:00Z",
        "role": "user",
        "is_active": True,
        "last_login": "2024-12-01T08:45:00Z",
    },
    "user_002": {
        "id": "user_002",
        "username": "jane_smith",
        "email": encrypt_data("jane.smith@example.com"),
        "password_hash": hash_password("anotherpassword456"),
        "full_name": "Jane Smith",
        "phone": encrypt_data("+1-555-0200"),
        "created_at": "2024-02-20T14:00:00Z",
        "role": "admin",
        "is_active": True,
        "last_login": "2024-12-02T09:15:00Z",
    },
}

# Token blacklist (in production, use Redis or a database)
token_blacklist = set()

def generate_token(user_id: str, role: str) -> str:
    """Generate a JWT token for authentication."""
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
        "iat": datetime.utcnow(),
        "jti": secrets.token_hex(16),  # JWT ID for blacklisting
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")

def token_required(f):
    """Decorator to enforce JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({
                "error": "Unauthorized",
                "message": "Authentication token is missing."
            }), 401

        try:
            payload = jwt.decode(
                token,
                app.config['SECRET_KEY'],
                algorithms=["HS256"]
            )

            # Check if token is blacklisted
            if payload.get("jti") in token_blacklist:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Token has been revoked."
                }), 401

            request.current_user = payload

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

def sanitize_user_id(user_id: str) -> bool:
    """Validate user ID format to prevent injection attacks."""
    if not user_id or not isinstance(user_id, str):
        return False
    # Allow only alphanumeric characters and underscores
    import re
    return bool(re.match(r'^[a-zA-Z0-9_]{1,50}$', user_id))

def get_safe_user_data(user: dict, include_sensitive: bool = False) -> dict:
    """
    Return user data with sensitive fields handled appropriately.
    Sensitive fields are decrypted only when authorized.
    """
    safe_data = {
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "is_active": user["is_active"],
        "created_at": user["created_at"],
        "last_login": user["last_login"],
    }

    if include_sensitive:
        safe_data["email"] = decrypt_data(user["email"])
        safe_data["phone"] = decrypt_data(user["phone"])
    else:
        # Mask sensitive data
        decrypted_email = decrypt_data(user["email"])
        parts = decrypted_email.split("@")
        if len(parts) == 2:
            masked_email = parts[0][0] + "*" * (len(parts[0]) - 1) + "@" + parts[1]
        else:
            masked_email = "***@***.***"
        safe_data["email"] = masked_email
        safe_data["phone"] = "***-****"

    return safe_data

@app.route("/auth/login", methods=["POST"])
def login():
    """Authenticate user and return a JWT token."""
    data = request.get_json()

    if not data or not data.get("username") or not data.get("password"):
        return jsonify({
            "error": "Bad Request",
            "message": "Username and password are required."
        }), 400

    username = data["username"].strip()
    password = data["password"]

    # Find user by username
    user = next(
        (u for u in users_db.values() if u["username"] == username),
        None
    )

    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify({
            "error": "Unauthorized",
            "message": "Invalid username or password."
        }), 401

    if not user["is_active"]:
        return jsonify({
            "error": "Forbidden",
            "message": "Account is deactivated."
        }), 403

    token = generate_token(user["id"], user["role"])

    return jsonify({
        "message": "Login successful.",
        "token": token,
        "user_id": user["id"],
    }), 200

@app.route("/users/<string:user_id>", methods=["GET"])
@token_required
def get_user_account(user_id: str):
    """
    Retrieve user account data for a given user ID.

    - Regular users can only access their own account data.
    - Admins can access any user's account data.
    - Sensitive data (email, phone) is only fully visible to admins or the account owner.
    """
    # Validate user_id format
    if not sanitize_user_id(user_id):
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid user ID format."
        }), 400

    current_user_id = request.current_user.get("user_id")
    current_user_role = request.current_user.get("role")

    # Authorization check: users can only view their own data unless they are