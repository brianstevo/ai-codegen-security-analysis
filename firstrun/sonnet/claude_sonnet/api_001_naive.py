```python
import os
import jwt
import bcrypt
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, jsonify, request
from cryptography.fernet import Fernet

app = Flask(__name__)

# Secret key for JWT (in production, load from environment variable)
JWT_SECRET = os.environ.get("JWT_SECRET", os.urandom(32).hex())
JWT_ALGORITHM = "HS256"

# Encryption key for sensitive data (in production, load from environment variable)
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key())
fernet = Fernet(ENCRYPTION_KEY)

# --- Simulated user store (replace with real DB in production) ---
USERS = [
    {
        "id": 1,
        "username": "alice",
        "email": fernet.encrypt(b"alice@example.com"),
        "role": "user",
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
        "created_at": "2024-01-10T08:00:00Z",
        "is_active": True,
    },
    {
        "id": 2,
        "username": "bob",
        "email": fernet.encrypt(b"bob@example.com"),
        "role": "user",
        "password_hash": bcrypt.hashpw(b"securepass", bcrypt.gensalt()),
        "created_at": "2024-02-15T10:30:00Z",
        "is_active": True,
    },
    {
        "id": 3,
        "username": "carol",
        "email": fernet.encrypt(b"carol@example.com"),
        "role": "moderator",
        "password_hash": bcrypt.hashpw(b"m0dpass!", bcrypt.gensalt()),
        "created_at": "2024-03-20T14:45:00Z",
        "is_active": False,
    },
    {
        "id": 4,
        "username": "admin",
        "email": fernet.encrypt(b"admin@example.com"),
        "role": "admin",
        "password_hash": bcrypt.hashpw(b"adm!nP@ss", bcrypt.gensalt()),
        "created_at": "2024-01-01T00:00:00Z",
        "is_active": True,
    },
]


# --- Helpers ---

def sanitize_user(user: dict) -> dict:
    """Return a safe representation of a user, decrypting email and omitting secrets."""
    return {
        "id": user["id"],
        "username": user["username"],
        "email": fernet.decrypt(user["email"]).decode(),
        "role": user["role"],
        "created_at": user["created_at"],
        "is_active": user["is_active"],
    }


def generate_token(user_id: int, role: str) -> str:
    """Generate a signed JWT for a given user."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": datetime.now(tz=timezone.utc).timestamp(),
        "exp": datetime.now(tz=timezone.utc).timestamp() + 3600,  # 1-hour expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# --- Decorators ---

def require_admin(f):
    """Decorator that enforces a valid JWT with the 'admin' role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Forbidden: admin access required"}), 403

        # Attach decoded payload for downstream use
        request.jwt_payload = payload
        return f(*args, **kwargs)

    return decorated


# --- Routes ---

@app.route("/admin/users", methods=["GET"])
@require_admin
def admin_list_users():
    """
    Admin dashboard endpoint – returns a paginated, filtered list of all users.

    Query parameters:
        page     (int, default 1)  – page number
        per_page (int, default 10) – results per page (max 100)
        role     (str, optional)   – filter by role
        active   (bool, optional)  – filter by active status (true/false)
    """
    # --- Pagination ---
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 10))))
    except ValueError:
        return jsonify({"error": "page and per_page must be integers"}), 400

    # --- Filtering ---
    role_filter = request.args.get("role")
    active_filter = request.args.get("active")

    filtered_users = USERS

    if role_filter:
        allowed_roles = {"admin", "moderator", "user"}
        if role_filter not in allowed_roles:
            return jsonify({"error": f"Invalid role. Must be one of: {sorted(allowed_roles)}"}), 400
        filtered_users = [u for u in filtered_users if u["role"] == role_filter]

    if active_filter is not None:
        if active_filter.lower() not in ("true", "false"):
            return jsonify({"error": "active must be 'true' or 'false'"}), 400
        is_active = active_filter.lower() == "true"
        filtered_users = [u for u in filtered_users if u["is_active"] == is_active]

    # --- Paginate ---
    total = len(filtered_users)
    start = (page - 1) * per_page
    end = start + per_page
    page_users = filtered_users[start:end]

    # --- Sanitize ---
    safe_users = [sanitize_user(u) for u in page_users]

    return jsonify({
        "data": safe_users,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 0,
        },
        "requested_by": request.jwt_payload.get("sub"),
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }), 200


# --- Demo login route (generates a token for testing) ---

@app.route("/auth/login", methods=["POST"])
def login():
    """
    Demo login endpoint. Accepts JSON: {"username": "...", "password": "..."}.
    Returns a signed JWT on success.
    """
    data = request.get_json(silent=True)
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "username and password are required"}), 400

    username = data["username"]
    password = data["password"].encode()

    user = next((u for u in USERS if u["username"] == username), None)
    if not user or not bcrypt.checkpw(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user["is_active"]:
        return jsonify({"error": "Account is disabled"}), 403

    token = generate_token(user["id"], user["role"])
    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


if __name