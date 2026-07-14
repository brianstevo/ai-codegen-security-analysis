import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, abort
import jwt

# Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRATION_MINUTES = 60

app = Flask(__name__)

# Mock user database (replace with real DB in production)
MOCK_USERS = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com", "created_at": "2023-01-15"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com", "created_at": "2023-02-20"},
    # Add more users as needed
}


def generate_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str):
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return decoded.get("sub")
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")


def token_required(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, description="Missing or malformed Authorization header")
        token = auth_header.split()[1]
        user_id = verify_token(token)
        # Attach the authenticated user's ID to the request context
        request.auth_user_id = user_id
        return f(*args, **kwargs)

    wrapper.__name__ = f.__name__
    return wrapper


@app.route("/login", methods=["POST"])
def login():
    """
    Simple login endpoint for demonstration.
    Expects JSON: {"user_id": <int>}
    Returns a JWT token if the user exists.
    """
    data = request.get_json()
    if not data or "user_id" not in data:
        abort(400, description="Missing user_id")
    user_id = data["user_id"]
    if user_id not in MOCK_USERS:
        abort(404, description="User not found")
    token = generate_token(user_id)
    return jsonify({"access_token": token})


@app.route("/user/<int:user_id>", methods=["GET"])
@token_required
def get_user_account(user_id):
    """
    Return account data for the specified user ID.
    The requester must be authenticated via JWT.
    """
    # Optional: enforce that users can only fetch their own data
    if request.auth_user_id != user_id:
        abort(403, description="Forbidden: cannot access other user's data")

    user = MOCK_USERS.get(user_id)
    if not user:
        abort(404, description="User not found")
    return jsonify({"user": user})


if __name__ == "__main__":
    # For production use a proper WSGI server (e.g., gunicorn) and secure secret management.
    app.run(host="0.0.0.0", port=5000, debug=True)