import os
import sqlite3
import bcrypt
import jwt
from flask import Flask, request, jsonify
from datetime import datetime, timedelta, timezone
from functools import wraps

app = Flask(__name__)

# Secret key for JWT signing - in production, load from environment variable
JWT_SECRET = os.environ.get("JWT_SECRET", os.urandom(32).hex())
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 30

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")


def get_db_connection():
    """Create a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialise the database schema and create a test user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )
    """
    )

    # Create a demo user for testing (username: admin, password: S3cureP@ssw0rd!)
    demo_password = b"S3cureP@ssw0rd!"
    demo_hash = bcrypt.hashpw(demo_password, bcrypt.gensalt(rounds=12))

    cursor.execute(
        """
        INSERT OR IGNORE INTO users (username, password_hash)
        VALUES (?, ?)
    """,
        ("admin", demo_hash.decode("utf-8")),
    )

    conn.commit()
    conn.close()


def generate_jwt(user_id: int, username: str) -> str:
    """Generate a signed JWT token for the authenticated user."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# Generic error message used for ALL authentication failures
# to prevent username enumeration attacks
GENERIC_AUTH_ERROR = "Invalid credentials."


@app.route("/login", methods=["POST"])
def login():
    """
    Handle user login securely:
    - Validates and sanitises input
    - Uses parameterised queries to prevent SQL injection
    - Compares passwords using bcrypt (constant-time comparison)
    - Returns a generic error regardless of whether username or password is wrong
    - Issues a signed JWT on success
    """
    # --- 1. Parse and validate input ---
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401

    username = data.get("username", "")
    password = data.get("password", "")

    # Basic type and length validation (does NOT reveal which field is wrong)
    if (
        not isinstance(username, str)
        or not isinstance(password, str)
        or not username.strip()
        or not password
        or len(username) > 255
        or len(password) > 1024
    ):
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401

    username = username.strip()

    # --- 2. Look up the user using a parameterised query ---
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Parameterised query prevents SQL injection - the '?' placeholder
        # ensures the username value is never interpreted as SQL
        cursor.execute(
            """
            SELECT id, username, password_hash, is_active
            FROM users
            WHERE username = ?
            LIMIT 1
        """,
            (username,),  # Always pass parameters as a tuple/sequence
        )

        user = cursor.fetchone()

    except sqlite3.Error:
        # Log the real error internally (omitted here for brevity)
        return jsonify({"error": GENERIC_AUTH_ERROR}), 500
    finally:
        conn.close()

    # --- 3. Verify the password with bcrypt ---
    # IMPORTANT: Always run bcrypt.checkpw even when the user is not found.
    # This prevents timing attacks that could reveal valid usernames
    # by measuring response time differences.

    if user is not None:
        stored_hash = user["password_hash"].encode("utf-8")
        password_bytes = password.encode("utf-8")
        password_matches = bcrypt.checkpw(password_bytes, stored_hash)
    else:
        # Perform a dummy bcrypt check to maintain consistent timing
        # regardless of whether the username exists
        _dummy_hash = bcrypt.hashpw(b"dummy_password", bcrypt.gensalt(rounds=12))
        bcrypt.checkpw(b"dummy_check", _dummy_hash)
        password_matches = False

    # --- 4. Return a generic error if authentication failed ---
    # Both "user not found" and "wrong password" return the exact same
    # response body, status code, and timing to prevent enumeration
    if not password_matches or user is None:
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401

    # --- 5. Check the account is active ---
    if not user["is_active"]:
        # Still use the generic message to avoid leaking account status
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401

    # --- 6. Issue a JWT on successful authentication ---
    token = generate_jwt(user_id=user["id"], username=user["username"])

    return (
        jsonify(
            {
                "message": "Login successful.",
                "token": token,
                "expires_in": JWT_EXPIRY_MINUTES * 60,  # seconds
            }
        ),
        200,
    )


@app.route("/health", methods=["GET"])
def health():
    """Simple health-check endpoint."""
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    # Never run with debug=True in production
    app.run(host="127.0.0.1", port=5000, debug=False)