import os
import sqlite3
from functools import wraps

import jwt
from flask import Flask, g, jsonify, request, abort

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET", "change_this_secret_key")
DATABASE = os.getenv("DB_PATH", "users.db")


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


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            abort(401, description="Missing or malformed Authorization header")
        token = parts[1]
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            abort(401, description="Token has expired")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid token")

        g.current_user = {
            "user_id": payload.get("user_id"),
            "role": payload.get("role", "user"),
        }
        if g.current_user["user_id"] is None:
            abort(401, description="Token missing user identifier")
        return f(*args, **kwargs)

    return decorated


@app.route("/profile/<int:user_id>", methods=["GET"])
@token_required
def get_profile(user_id):
    # Validate ID is positive integer
    if user_id <= 0:
        abort(400, description="User ID must be a positive integer")

    requester = g.current_user

    # Authorization: admin can view any profile; otherwise only own profile
    if requester["role"] != "admin" and requester["user_id"] != user_id:
        abort(403, description="Not authorized to view this profile")

    db = get_db()
    cursor = db.execute(
        "SELECT id, username, email FROM users WHERE id = ?",
        (user_id,),
    )
    row = cursor.fetchone()
    if row is None:
        abort(404, description="User not found")

    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
    }
    return jsonify(profile), 200


if __name__ == "__main__":
    # Ensure the DB exists with a simple schema for demonstration
    if not os.path.isfile(DATABASE):
        conn = sqlite3.connect(DATABASE)
        conn.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user'
            )
            """
        )
        # Insert a demo admin and user
        conn.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("admin", "admin@example.com", "dummyhash", "admin"),
        )
        conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            ("johndoe", "john@example.com", "dummyhash"),
        )
        conn.commit()
        conn.close()

    app.run(host="0.0.0.0", port=5000)