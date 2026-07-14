import os
import datetime
from functools import wraps

from flask import Flask, request, jsonify, abort
import jwt  # PyJWT
from werkzeug.security import safe_str_cmp

app = Flask(__name__)

# Secret key for JWT signing/verification (in production use env var or secret manager)
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXP_DELTA_SECONDS = 3600

# Mock user database
_USERS_DB = {
    # user_id: user_record
    "1": {
        "id": "1",
        "username": "alice",
        "email": "alice@example.com",
        "role": "user",
        "password_hash": "$2b$12$KIX/5eG6YpZcV8f9QhXUOe",  # bcrypt hash (placeholder)
        "ssn": "123-45-6789",
        "credit_card": "4111111111111111",
    },
    "2": {
        "id": "2",
        "username": "bob",
        "email": "bob@example.com",
        "role": "admin",
        "password_hash": "$2b$12$7sG9vK8YpZcV8f9QhXUOe",  # bcrypt hash (placeholder)
        "ssn": "987-65-4321",
        "credit_card": "5555555555554444",
    },
}


def generate_jwt(user_id: str, role: str) -> str:
    """Utility to create a JWT for testing purposes."""
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    # PyJWT >=2 returns str, older versions return bytes
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def decode_jwt(token: str) -> dict:
    """Decode and verify a JWT. Raises jwt exceptions on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, description="Missing or malformed Authorization header")
        token = auth_header.split(None, 1)[1]
        try:
            payload = decode_jwt(token)
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired")
        except jwt.InvalidTokenError as e:
            abort(401, description=f"Invalid token: {str(e)}")

        request.user = {
            "id": payload.get("sub"),
            "role": payload.get("role", "user"),
        }
        return f(*args, **kwargs)

    return decorated


def strip_sensitive_fields(user_record: dict) -> dict:
    """Return a copy of user data without sensitive fields."""
    sanitized = {k: v for k, v in user_record.items() if k not in {"password_hash", "ssn", "credit_card"}}
    return sanitized


@app.route("/account/<user_id>", methods=["GET"])
@auth_required
def get_account(user_id):
    # Verify that the requested user exists
    user = _USERS_DB.get(user_id)
    if not user:
        abort(404, description="User not found")

    # Authorization: allow if requester is admin or requesting own data
    requester = request.user
    if not (requester["role"] == "admin" or safe_str_cmp(requester["id"], user_id)):
        abort(403, description="Forbidden: insufficient privileges")

    sanitized_user = strip_sensitive_fields(user)
    return jsonify(sanitized_user), 200


# Example route to obtain a token for testing
@app.route("/login", methods=["POST"])
def login():
    """
    Expected JSON payload:
    {
        "username": "...",
        "password": "..."
    }
    This mock implementation checks username only and returns a JWT.
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")  # In real code, verify with bcrypt

    # Find user by username
    for u in _USERS_DB.values():
        if safe_str_cmp(u["username"], username):
            # Skipping actual password verification for brevity
            token = generate_jwt(u["id"], u["role"])
            return jsonify({"access_token": token}), 200

    abort(401, description="Invalid credentials")


if __name__ == "__main__":
    app.run(debug=True)