import os
import re
import sqlite3
from datetime import datetime, timedelta

import bcrypt
import jwt
from flask import Flask, request, jsonify, g, abort

# -------------------- Configuration --------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET", "super-secret-key")
app.config["JWT_ALGORITHM"] = "HS256"
app.config["TOKEN_EXP_DAYS"] = 7
DATABASE = os.getenv("DB_PATH", ":memory:")

# Whitelist of fields that can be updated via the endpoint
UPDATABLE_FIELDS = {"username", "email", "bio", "password"}

# -------------------- Database Helpers --------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    """Create a simple users table for demonstration."""
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash BLOB NOT NULL,
            bio TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    db.commit()

# -------------------- Validation Utilities --------------------
def is_valid_email(email: str) -> bool:
    return re.fullmatch(r"[^@]+@[^@]+\.[^@]+", email) is not None

def is_valid_username(username: str) -> bool:
    return 3 <= len(username) <= 30 and username.isalnum()

def is_valid_bio(bio: str) -> bool:
    return len(bio) <= 500

# -------------------- Authentication --------------------
def generate_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=app.config["TOKEN_EXP_DAYS"]),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm=app.config["JWT_ALGORITHM"])

def token_required(f):
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        parts = auth.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            abort(401, description="Missing or malformed Authorization header")
        token = parts[1]
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=[app.config["JWT_ALGORITHM"]])
            g.current_user_id = payload["sub"]
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            abort(401, description="Invalid or expired token")
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# -------------------- Routes --------------------
@app.route("/api/profile/<int:user_id>", methods=["PUT"])
@token_required
def update_profile(user_id: int):
    # Ensure the authenticated user is updating their own profile
    if g.current_user_id != user_id:
        abort(403, description="You can only modify your own profile")

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        abort(400, description="Invalid JSON payload")

    # Filter out fields that are not allowed to be updated
    update_data = {k: v for k, v in data.items() if k in UPDATABLE_FIELDS}
    if not update_data:
        abort(400, description="No updatable fields provided")

    errors = {}

    # Validate each field
    if "username" in update_data and not is_valid_username(update_data["username"]):
        errors["username"] = "Username must be 3-30 alphanumeric characters"
    if "email" in update_data and not is_valid_email(update_data["email"]):
        errors["email"] = "Invalid email format"
    if "bio" in update_data and not is_valid_bio(update_data["bio"]):
        errors["bio"] = "Bio must be 500 characters or fewer"

    # Password handling: hash before storing
    if "password" in update_data:
        pwd = update_data.pop("password")
        if not isinstance(pwd, str) or len(pwd) < 8:
            errors["password"] = "Password must be at least 8 characters long"
        else:
            hashed = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt())
            update_data["password_hash"] = hashed

    if errors:
        return jsonify({"errors": errors}), 400

    # Build the SET clause dynamically using parameterized queries
    set_clause = ", ".join([f"{field} = ?" for field in update_data.keys()])
    values = list(update_data.values())
    values.append(user_id)  # For WHERE clause

    sql = f"UPDATE users SET {set_clause} WHERE id = ?"

    db = get_db()
    try:
        cur = db.execute(sql, values)
        if cur.rowcount == 0:
            abort(404, description="User not found")
        db.commit()
    except sqlite3.IntegrityError as e:
        # Handle unique constraint violations (e.g., duplicate email/username)
        return jsonify({"error": str(e)}), 409

    return jsonify({"message": "Profile updated successfully"}), 200

# -------------------- Example Auth Endpoints (for testing) --------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not all([username, email, password]):
        abort(400, description="Missing required fields")

    if not is_valid_username(username):
        abort(400, description="Invalid username")
    if not is_valid_email(email):
        abort(400, description="Invalid email")
    if len(password) < 8:
        abort(400, description="Password too short")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash),
        )
        user_id = cur.lastrowid
        db.commit()
    except sqlite3.IntegrityError as e:
        return jsonify({"error": str(e)}), 409

    token = generate_token(user_id)
    return jsonify({"token": token}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not all([email, password]):
        abort(400, description="Missing credentials")

    db = get_db()
    user = db.execute(
        "SELECT id, password_hash FROM users WHERE email = ?", (email,)
    ).fetchone()

    if user is None or not bcrypt.checkpw(password.encode(), user["password_hash"]):
        abort(401, description="Invalid email or password")

    token = generate_token(user["id"])
    return jsonify({"token": token}), 200

# -------------------- Application Entry Point --------------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True)