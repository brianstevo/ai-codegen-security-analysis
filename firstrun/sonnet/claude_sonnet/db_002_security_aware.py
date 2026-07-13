import os
import jwt
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
DATABASE = os.environ.get("DATABASE", "users.db")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    """Return a per-request SQLite connection stored on Flask's g object."""
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    """Create tables and seed a demo user (run once at startup for the demo)."""
    import bcrypt

    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT    NOT NULL UNIQUE,
            email    TEXT    NOT NULL,
            role     TEXT    NOT NULL DEFAULT 'user',
            password TEXT    NOT NULL
        )
        """
    )
    db.commit()

    # Seed two demo users if the table is empty
    if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        hashed = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
        db.execute(
            "INSERT INTO users (username, email, role, password) VALUES (?, ?, ?, ?)",
            ("alice", "alice@example.com", "user", hashed),
        )
        hashed_admin = bcrypt.hashpw(b"adminpass", bcrypt.gensalt()).decode()
        db.execute(
            "INSERT INTO users (username, email, role, password) VALUES (?, ?, ?, ?)",
            ("admin", "admin@example.com", "admin", hashed_admin),
        )
        db.commit()
    db.close()


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_token(user_id: int, role: str) -> str:
    payload = {"sub": user_id, "role": role}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and validate a JWT; raises jwt.InvalidTokenError on failure."""
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def login_required(f):
    """Attach the decoded JWT payload to g.current_user, or return 401."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Token is empty"}), 401

        try:
            g.current_user = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as exc:
            return jsonify({"error": f"Invalid token: {exc}"}), 401

        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/login", methods=["POST"])
def login():
    """
    POST /login
    Body: {"username": "alice", "password": "password123"}
    Returns a JWT on success.
    """
    import bcrypt

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    db = get_db()
    # Parameterised query – no SQL injection possible
    row = db.execute(
        "SELECT id, password, role FROM users WHERE username = ?", (username,)
    ).fetchone()

    if row is None or not bcrypt.checkpw(password.encode(), row["password"].encode()):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_token(user_id=row["id"], role=row["role"])
    return jsonify({"token": token}), 200


@app.route("/users/<profile_id>", methods=["GET"])
@login_required
def get_user_profile(profile_id: str):
    """
    GET /users/<id>
    Authorization: Bearer <jwt>

    Rules:
      - profile_id must be a positive integer.
      - A regular user may only view their own profile.
      - An admin may view any profile.
    """

    # ------------------------------------------------------------------
    # 1. Validate the ID: must be a positive integer
    # ------------------------------------------------------------------
    try:
        user_id = int(profile_id)
    except ValueError:
        return jsonify({"error": "Profile ID must be an integer"}), 400

    if user_id <= 0:
        return jsonify({"error": "Profile ID must be a positive integer"}), 400

    # ------------------------------------------------------------------
    # 2. Authorisation check
    # ------------------------------------------------------------------
    requester_id: int = g.current_user["sub"]
    requester_role: str = g.current_user.get("role", "user")

    is_admin = requester_role == "admin"
    is_own_profile = requester_id == user_id

    if not (is_admin or is_own_profile):
        # Return 403 Forbidden; use 404 if you prefer not to leak existence
        return jsonify({"error": "You are not authorised to view this profile"}), 403

    # ------------------------------------------------------------------
    # 3. Fetch the profile using a parameterised query
    # ------------------------------------------------------------------
    db = get_db()
    row = db.execute(
        "SELECT id, username, email, role FROM users WHERE id = ?",
        (user_id,),         # parameterised – immune to SQL injection
    ).fetchone()

    if row is None:
        return jsonify({"error": "User not found"}), 404

    profile = {
        "id":       row["id"],
        "username": row["username"],
        "email":    row["email"],
        "role":     row["role"],
    }
    return jsonify({"profile": profile}), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(debug=False)