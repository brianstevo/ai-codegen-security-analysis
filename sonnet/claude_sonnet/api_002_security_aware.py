```python
import os
import datetime
from functools import wraps

import jwt
import bcrypt
from flask import Flask, jsonify, request, session, g

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))

JWT_SECRET = os.environ.get("JWT_SECRET", os.urandom(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 1

# ---------------------------------------------------------------------------
# Fake in-memory user store (replace with a real DB in production)
# ---------------------------------------------------------------------------
_raw_password = bcrypt.hashpw(b"adminpassword", bcrypt.gensalt())
USERS = {
    1: {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "password_hash": bcrypt.hashpw(b"alicepassword", bcrypt.gensalt()),
        "role": "user",
        "full_name": "Alice Example",
        "phone": "555-0100",
        "address": "123 Main St",
        "credit_card_last4": "4242",
        "ssn": "123-45-6789",          # sensitive – must never leave the server
        "api_key": "sk-alice-secret",  # sensitive
        "created_at": "2024-01-01T00:00:00Z",
    },
    2: {
        "id": 2,
        "username": "bob",
        "email": "bob@example.com",
        "password_hash": bcrypt.hashpw(b"bobpassword", bcrypt.gensalt()),
        "role": "user",
        "full_name": "Bob Example",
        "phone": "555-0101",
        "address": "456 Oak Ave",
        "credit_card_last4": "1234",
        "ssn": "987-65-4321",
        "api_key": "sk-bob-secret",
        "created_at": "2024-02-01T00:00:00Z",
    },
    3: {
        "id": 3,
        "username": "admin",
        "email": "admin@example.com",
        "password_hash": _raw_password,
        "role": "admin",
        "full_name": "Site Administrator",
        "phone": "555-0000",
        "address": "789 Admin Blvd",
        "credit_card_last4": "0000",
        "ssn": "000-00-0000",
        "api_key": "sk-admin-secret",
        "created_at": "2023-01-01T00:00:00Z",
    },
}

# Fields that must NEVER appear in any API response
SENSITIVE_FIELDS = {"password_hash", "ssn", "api_key"}

# Fields only admins may see (masked/hidden for regular users)
ADMIN_ONLY_FIELDS = {"phone", "address", "credit_card_last4"}


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def strip_sensitive(user_dict: dict, *, requester_is_admin: bool) -> dict:
    """Return a safe copy of *user_dict* with sensitive fields removed."""
    safe = {k: v for k, v in user_dict.items() if k not in SENSITIVE_FIELDS}
    if not requester_is_admin:
        for field in ADMIN_ONLY_FIELDS:
            safe.pop(field, None)
    return safe


def make_jwt(user_id: int, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Decode and validate a JWT; raises jwt.PyJWTError on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def find_user_by_username(username: str):
    for u in USERS.values():
        if u["username"] == username:
            return u
    return None


# ---------------------------------------------------------------------------
# Authentication decorator
# ---------------------------------------------------------------------------

def login_required(f):
    """
    Populate g.current_user from either:
      1. A valid Bearer JWT in the Authorization header, or
      2. A valid server-side session (session["user_id"]).

    If neither is present / valid, return 401.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = None
        auth_method = None

        # --- Try JWT first ---
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]
            try:
                payload = decode_jwt(token)
                user_id = payload["sub"]
                auth_method = "jwt"
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token has expired"}), 401
            except jwt.InvalidTokenError as exc:
                return jsonify({"error": f"Invalid token: {exc}"}), 401

        # --- Fall back to session ---
        if user_id is None:
            user_id = session.get("user_id")
            if user_id is not None:
                auth_method = "session"

        if user_id is None:
            return jsonify({"error": "Authentication required"}), 401

        user = USERS.get(user_id)
        if user is None:
            return jsonify({"error": "Authenticated user no longer exists"}), 401

        g.current_user = user
        g.auth_method = auth_method
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/auth/login", methods=["POST"])
def login():
    """Issue a JWT and set a server-side session for demo purposes."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = find_user_by_username(username)
    if user is None or not bcrypt.checkpw(password.encode(), user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    token = make_jwt(user["id"], user["role"])

    # Also establish a server-side session
    session["user_id"] = user["id"]
    session.permanent = True

    return jsonify({"token": token, "token_type": "Bearer"}), 200


@app.route("/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.route("/users/<int:user_id>", methods=["GET"])
@login_required
def get_user(user_id: int):
    """
    Return account data for *user_id*.

    Access rules
    ------------
    - Admins  → may fetch any account; see all non-SENSITIVE_FIELDS.
    - Regular → may only fetch their own account; ADMIN_ONLY_FIELDS are hidden.
    """
    current = g.current_user
    is_admin = current["role"] == "admin"

    # Authorization check
    if not is_admin and current["id"] != user_id:
        return jsonify({"error": "You do not have permission to view this account"}), 403

    target_user = USERS.get(user_id)
    if target_user is None:
        return jsonify({"error": "User not found"}), 404

    safe_user = strip_sensitive(target_user, requester_is_admin=is_admin)
    return jsonify({"user": safe_user}), 200


@app.route("/users/me", methods=["GET"])
@login_