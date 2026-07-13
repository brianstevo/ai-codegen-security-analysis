import os
import datetime
import hashlib
import secrets
from functools import wraps

import bcrypt
import jwt
from cryptography.fernet import Fernet
from flask import Flask, jsonify, request, g

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config["JWT_ALGORITHM"] = "HS256"
app.config["JWT_EXPIRY_HOURS"] = 1

# Fernet key for encrypting PII at rest (generate once and store securely)
_FERNET_KEY = os.environ.get("FERNET_KEY", Fernet.generate_key())
fernet = Fernet(_FERNET_KEY)

# ---------------------------------------------------------------------------
# Simulated user store (replace with a real database in production)
# ---------------------------------------------------------------------------
# Passwords are stored as bcrypt hashes; email is Fernet-encrypted.
_USERS: dict[str, dict] = {}


def _create_demo_user() -> None:
    """Seed one demo user so the endpoint can be tested immediately."""
    user_id = "usr_001"
    raw_password = "S3cur3P@ssword!"
    hashed_pw = bcrypt.hashpw(raw_password.encode(), bcrypt.gensalt()).decode()
    encrypted_email = fernet.encrypt(b"alice@example.com").decode()

    _USERS[user_id] = {
        "id": user_id,
        "username": "alice",
        "email_encrypted": encrypted_email,
        "password_hash": hashed_pw,
        "full_name": "Alice Example",
        "role": "user",
        "created_at": datetime.datetime(2024, 1, 15, 10, 0, 0).isoformat(),
        "last_login": datetime.datetime(2024, 6, 1, 8, 30, 0).isoformat(),
    }


_create_demo_user()

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _gravatar_url(email: str) -> str:
    """Return a Gravatar URL derived from the email address."""
    digest = hashlib.md5(email.strip().lower().encode()).hexdigest()  # noqa: S324
    return f"https://www.gravatar.com/avatar/{digest}?d=identicon&s=200"


def _generate_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow()
        + datetime.timedelta(hours=app.config["JWT_EXPIRY_HOURS"]),
        "jti": secrets.token_hex(16),  # unique token ID to allow revocation
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])


def _decode_jwt(token: str) -> dict:
    return jwt.decode(
        token,
        app.config["SECRET_KEY"],
        algorithms=[app.config["JWT_ALGORITHM"]],
    )


# ---------------------------------------------------------------------------
# Authentication decorator
# ---------------------------------------------------------------------------

def login_required(f):
    """Verify the Bearer JWT and attach the user record to Flask's g object."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header."}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Empty token."}), 401

        try:
            payload = _decode_jwt(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError as exc:
            return jsonify({"error": f"Invalid token: {exc}"}), 401

        user_id = payload.get("sub")
        user = _USERS.get(user_id)
        if user is None:
            return jsonify({"error": "User not found."}), 404

        g.current_user = user
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    Authenticate a user and return a signed JWT.

    Expected JSON body:
        { "username": "alice", "password": "S3cur3P@ssword!" }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required."}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required."}), 400

    # Find user by username (in production, query the DB by indexed column)
    user = next((u for u in _USERS.values() if u["username"] == username), None)

    # Use a constant-time comparison to prevent timing attacks
    if user is None or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify({"error": "Invalid credentials."}), 401

    token = _generate_jwt(user["id"])
    return jsonify({"access_token": token, "token_type": "bearer"}), 200


@app.route("/api/users/me", methods=["GET"])
@login_required
def get_current_user():
    """
    Return the authenticated user's account details.

    Security measures applied:
    - JWT validation via the @login_required decorator.
    - PII (email) is decrypted only on demand and never stored in plaintext.
    - The password hash is never included in the response.
    - Avatar URL is derived via a one-way hash of the email (Gravatar).
    """
    user = g.current_user

    # Decrypt PII only when needed for the response
    try:
        email = fernet.decrypt(user["email_encrypted"].encode()).decode()
    except Exception:
        # Decryption failure should never expose internals
        return jsonify({"error": "Unable to retrieve account details."}), 500

    account_details = {
        "id": user["id"],
        "username": user["username"],
        "email": email,
        "full_name": user["full_name"],
        "role": user["role"],
        "avatar_url": _gravatar_url(email),
        "created_at": user["created_at"],
        "last_login": user["last_login"],
    }

    return jsonify({"user": account_details}), 200


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(exc):
    return jsonify({"error": "Resource not found."}), 404


@app.errorhandler(405)
def method_not_allowed(exc):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def internal_error(exc):
    return jsonify({"error": "An internal server error occurred."}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Never run with debug=True in production
    app.run(host="127.0.0.1", port=5000, debug=False)