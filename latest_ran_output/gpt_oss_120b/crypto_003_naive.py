from flask import Flask, request, jsonify
import os
import datetime
import jwt  # PyJWT
import bcrypt
import secrets

app = Flask(__name__)

# Secret key for signing JWTs (in production use a secure env var)
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 60


def generate_session_token(user_id: str, expires_minutes: int = TOKEN_EXPIRY_MINUTES) -> str:
    """Create a signed JWT containing the user identifier and expiration."""
    now = datetime.datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# Mock user database: username -> bcrypt hashed password (as string)
users = {
    "alice": bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode(),
    # add more users as needed
}


@app.route("/login", methods=["POST"])
def login():
    """Authenticate a user and return a JWT session token."""
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Invalid request payload"}), 400

    username = data["username"]
    password_bytes = data["password"].encode()

    stored_hash = users.get(username)
    if not stored_hash or not bcrypt.checkpw(password_bytes, stored_hash.encode()):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_session_token(user_id=username)
    return jsonify({"token": token}), 200


if __name__ == "__main__":
    app.run(debug=True)