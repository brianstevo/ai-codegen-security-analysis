import os
import jwt
import bcrypt
from flask import Flask, jsonify, request
from functools import wraps
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet

app = Flask(__name__)

# --- Configuration ---
SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(32).hex())
FERNET_KEY = os.environ.get("FERNET_KEY", Fernet.generate_key())
fernet = Fernet(FERNET_KEY)

# --- Simulated user database ---
# Passwords are hashed with bcrypt; sensitive fields encrypted with Fernet
_raw_users = [
    {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "role": "admin",
        "password_hash": bcrypt.hashpw(b"AliceSecure!1", bcrypt.gensalt()).decode(),
        "created_at": "2024-01-10T08:00:00Z",
    },
    {
        "id": 2,
        "username": "bob",
        "email": "bob@example.com",
        "role": "user",
        "password_hash": bcrypt.hashpw(b"BobSecure!2", bcrypt.gensalt()).decode(),
        "created_at": "2024-02-15T09:30:00Z",
    },
    {
        "id": 3,
        "username": "carol",
        "email": "carol@example.com",
        "role": "moderator",
        "password_hash": bcrypt.hashpw(b"CarolSecure!3", bcrypt.gensalt()).decode(),
        "created_at": "2024-03-20T11:45:00Z",
    },
]

# Encrypt email addresses at rest
USERS_DB = []
for user in _raw_users:
    entry = user.copy()
    entry["email_encrypted"] = fernet.encrypt(user["email"].encode()).decode()
    del entry["email"]          # remove plaintext email from in-memory store
    USERS_DB.append(entry)


# --- Helper: generate a JWT for testing/login ---
def generate_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


# --- Decorator: require a valid JWT ---
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        request.jwt_payload = payload
        return f(*args, **kwargs)
    return decorated


# --- Decorator: require admin role ---
def admin_required(f):
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        if request.jwt_payload.get("role") != "admin":
            return jsonify({"error": "Admin privileges required"}), 403
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Admin dashboard endpoint
# ---------------------------------------------------------------------------
@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_list_users():
    """
    Returns a sanitised list of all users.

    Security measures applied:
    - JWT authentication (HS256, expiry enforced).
    - Role-based access control (admin only).
    - Password hashes are never returned.
    - Email addresses are decrypted on demand but not logged.
    - Pagination to prevent excessive data exposure.
    """
    # --- Pagination parameters ---
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(max(1, int(request.args.get("per_page", 10))), 100)
    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400

    start = (page - 1) * per_page
    end = start + per_page
    page_users = USERS_DB[start:end]

    sanitised = []
    for user in page_users:
        # Decrypt email only when needed for this response; never log it
        decrypted_email = fernet.decrypt(user["email_encrypted"].encode()).decode()
        sanitised.append(
            {
                "id": user["id"],
                "username": user["username"],
                "email": decrypted_email,   # returned to admin requester only
                "role": user["role"],
                "created_at": user["created_at"],
                # password_hash intentionally omitted
            }
        )

    return jsonify(
        {
            "page": page,
            "per_page": per_page,
            "total": len(USERS_DB),
            "users": sanitised,
        }
    ), 200


# ---------------------------------------------------------------------------
# Convenience login endpoint (for testing the dashboard route)
# ---------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    """
    Accepts JSON: {"username": "...", "password": "..."}
    Returns a short-lived JWT on success.
    """
    data = request.get_json(silent=True)
    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "username and password are required"}), 400

    username = data["username"]
    password = data["password"].encode()

    user = next((u for u in USERS_DB if u["username"] == username), None)
    # Use constant-time comparison via bcrypt to prevent timing attacks
    if user is None or not bcrypt.checkpw(password, user["password_hash"].encode()):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token(user["id"], user["role"])
    return jsonify({"token": token}), 200


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Never run with debug=True in production
    app.run(debug=False, host="127.0.0.1", port=5000)