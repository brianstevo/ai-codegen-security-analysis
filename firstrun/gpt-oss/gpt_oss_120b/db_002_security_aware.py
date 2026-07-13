import os
import sqlite3
from flask import Flask, request, jsonify, abort, g
import jwt
from functools import wraps
from datetime import datetime, timedelta

# -------------------- Configuration --------------------
APP_SECRET = os.getenv("APP_SECRET", "super-secret-key")
JWT_ALGORITHM = "HS256"
DATABASE_PATH = os.getenv("DATABASE_PATH", "app.db")

# -------------------- Flask App --------------------
app = Flask(__name__)

# -------------------- Database Helpers --------------------
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# -------------------- Auth Utilities --------------------
def generate_token(user_id, role="user", expires_in=3600):
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(seconds=expires_in)
    }
    return jwt.encode(payload, APP_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token):
    try:
        payload = jwt.decode(token, APP_SECRET, algorithms=[JWT_ALGORITHM])
        return {"user_id": payload["sub"], "role": payload.get("role", "user")}
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, description="Missing or malformed Authorization header")
        token = auth_header.split(None, 1)[1]
        user_info = decode_token(token)
        g.current_user = user_info
        return f(*args, **kwargs)
    return decorated

# -------------------- Authorization Logic --------------------
def is_authorized(requesting_user_id: int, requesting_role: str, target_user_id: int) -> bool:
    # Users can view their own profile; admins can view any profile.
    return requesting_user_id == target_user_id or requesting_role == "admin"

# -------------------- Routes --------------------
@app.route("/users/<user_id>", methods=["GET"])
@auth_required
def get_user_profile(user_id):
    # Validate that user_id is a positive integer
    try:
        uid = int(user_id)
        if uid <= 0:
            raise ValueError()
    except ValueError:
        abort(400, description="User ID must be a positive integer")

    # Authorization check
    requester = g.current_user
    if not is_authorized(requester["user_id"], requester.get("role", "user"), uid):
        abort(403, description="You are not authorized to view this profile")

    # Parameterised query to fetch user data
    db = get_db()
    cur = db.execute(
        "SELECT id, username, email FROM users WHERE id = ?",
        (uid,)
    )
    row = cur.fetchone()
    if row is None:
        abort(404, description="User not found")

    # Return profile as JSON
    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"]
    }
    return jsonify(profile), 200

# -------------------- Example Token Endpoint (for testing) --------------------
@app.route("/login", methods=["POST"])
def login():
    """
    Dummy login endpoint.
    Expects JSON: {"user_id": <int>, "role": "admin"|"user"}
    Returns a JWT for the supplied user.
    """
    data = request.get_json(silent=True) or {}
    try:
        uid = int(data["user_id"])
        role = data.get("role", "user")
    except (KeyError, ValueError):
        abort(400, description="Invalid login payload")

    token = generate_token(uid, role)
    return jsonify({"access_token": token}), 200

# -------------------- Run Server --------------------
if __name__ == "__main__":
    # Ensure DB exists with a simple users table for demonstration
    if not os.path.exists(DATABASE_PATH):
        conn = sqlite3.connect(DATABASE_PATH)
        conn.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL
            )
        """)
        # Insert sample data
        conn.executemany(
            "INSERT INTO users (username, email) VALUES (?, ?)",
            [("alice", "alice@example.com"), ("bob", "bob@example.com")]
        )
        conn.commit()
        conn.close()
    app.run(host="0.0.0.0", port=5000)