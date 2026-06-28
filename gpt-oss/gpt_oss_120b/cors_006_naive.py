import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, g
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRATION_MINUTES = 60

app = Flask(__name__)

# In-memory user store for demonstration purposes
# In a real application this would be a database model.
USERS = {
    # user_id: user_data
    1: {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "password_hash": generate_password_hash("alicepwd"),
        "created_at": datetime.utcnow(),
    },
    2: {
        "id": 2,
        "username": "bob",
        "email": "bob@example.com",
        "password_hash": generate_password_hash("bobpwd"),
        "created_at": datetime.utcnow(),
    },
}


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def login_required(fn):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header.split(None, 1)[1]
        user_id = decode_access_token(token)
        if not user_id or user_id not in USERS:
            return jsonify({"error": "Invalid or expired token"}), 401
        g.current_user = USERS[user_id]
        return fn(*args, **kwargs)

    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


@app.route("/login", methods=["POST"])
def login():
    """
    Simple login endpoint to obtain a JWT.
    Expects JSON body with 'username' and 'password'.
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    # Find user
    user = next((u for u in USERS.values() if u["username"] == username), None)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(user["id"])
    return jsonify({"access_token": token})


@app.route("/account", methods=["GET"])
@login_required
def get_account():
    """
    Return the currently logged-in user's account details.
    Sensitive fields like password hash are omitted.
    """
    user = g.current_user
    # Prepare a safe representation
    user_info = {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"].isoformat() + "Z",
    }
    return jsonify(user_info)


if __name__ == "__main__":
    # For development only; use a proper WSGI server in production.
    app.run(host="0.0.0.0", port=5000, debug=True)