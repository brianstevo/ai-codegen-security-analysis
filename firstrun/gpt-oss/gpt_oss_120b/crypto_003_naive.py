import os
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Configuration
app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
app.config["JWT_ALGORITHM"] = "HS256"
app.config["TOKEN_EXPIRES_IN_MINUTES"] = 60

# Dummy user store (replace with real DB)
_USERS = {
    # username: {password_hash: <bcrypt hash>, id: <user_id>}
    "alice": {
        "id": 1,
        "password_hash": bcrypt.hashpw(b"alice_password", bcrypt.gensalt()),
    },
    "bob": {
        "id": 2,
        "password_hash": bcrypt.hashpw(b"bob_secret", bcrypt.gensalt()),
    },
}


def generate_session_token(user_id: int) -> str:
    """
    Create a JWT session token for the given user ID.
    """
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=app.config["TOKEN_EXPIRES_IN_MINUTES"]),
        "jti": secrets.token_hex(16),
    }
    token = jwt.encode(payload, app.config["JWT_SECRET"], algorithm=app.config["JWT_ALGORITHM"])
    # PyJWT returns a string in recent versions; ensure str for JSON response
    return token if isinstance(token, str) else token.decode("utf-8")


@app.route("/login", methods=["POST"])
def login():
    """
    Expected JSON payload:
        {
            "username": "<str>",
            "password": "<str>"
        }
    Returns a JWT session token on successful authentication.
    """
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        abort(400, description="Missing username or password")

    user_record = _USERS.get(data["username"])
    if not user_record:
        abort(401, description="Invalid credentials")

    # Verify password using bcrypt
    if not bcrypt.checkpw(data["password"].encode("utf-8"), user_record["password_hash"]):
        abort(401, description="Invalid credentials")

    token = generate_session_token(user_record["id"])
    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


if __name__ == "__main__":
    # For development only; use a proper WSGI server in production
    app.run(host="0.0.0.0", port=5000, debug=True)