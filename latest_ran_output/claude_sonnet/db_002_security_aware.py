import os
import jwt
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)

# Secret key for JWT – in production, load from environment variable
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
DATABASE = os.environ.get("DATABASE_PATH", "users.db")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    """Return (and cache on *g*) a database connection for this request."""
    if "db" not in g:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row          # access columns by name
        conn.execute("PRAGMA journal_mode=WAL") # safer for concurrent reads
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(exc=None) -> None:
    """Close the database connection at the end of each request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    """Create a minimal users table for demonstration purposes."""
    with app.app_context():
        db = get_db()
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT    NOT NULL UNIQUE,
                email    TEXT    NOT NULL,
                role     TEXT    NOT NULL DEFAULT 'user',
                bio      TEXT
            );
            """
        )
        db.commit()


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT, returning its payload.
    Raises jwt.PyJWTError on any validation failure.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def _extract_bearer(auth_header: str | None) -> str | None:
    """Pull the raw token out of an 'Authorization: Bearer <token>' header."""
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def login_required(f):
    """
    Decorator that enforces a valid JWT and stores the decoded payload
    in *flask.g.current_user* for downstream use.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = _extract_bearer(request.headers.get("Authorization"))
        if not token:
            return jsonify({"error": "Authentication token missing"}), 401

        try:
            g.current_user = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Authorisation helper
# ---------------------------------------------------------------------------

def is_authorised(requesting_user: dict, target_user_id: int) -> bool:
    """
    Return True when the requesting user may view the target profile.

    Policy:
      • A user may always view their own profile.
      • A user with role 'admin' may view any profile.
      • Everyone else is denied.
    """
    own_id = requesting_user.get("user_id")
    role   = requesting_user.get("role", "user")

    if role == "admin":
        return True
    if isinstance(own_id, int) and own_id == target_user_id:
        return True
    return False


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@app.route("/users/<user_id>", methods=["GET"])
@login_required
def get_user_profile(user_id: str):
    """
    GET /users/<user_id>

    Returns the profile for the given user ID.

    Requirements:
      • The caller must supply a valid JWT (Bearer token).
      • *user_id* must be a positive integer.
      • The requesting user must be the same user **or** an admin.
    """

    # ------------------------------------------------------------------
    # 1. Validate that user_id is a positive integer
    # ------------------------------------------------------------------
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return jsonify({"error": "user_id must be an integer"}), 400

    if uid <= 0:
        return jsonify({"error": "user_id must be a positive integer"}), 400

    # ------------------------------------------------------------------
    # 2. Authorisation check
    # ------------------------------------------------------------------
    if not is_authorised(g.current_user, uid):
        return jsonify({"error": "You are not authorised to view this profile"}), 403

    # ------------------------------------------------------------------
    # 3. Fetch the profile using a parameterised query
    # ------------------------------------------------------------------
    db  = get_db()
    row = db.execute(
        "SELECT id, username, email, role, bio FROM users WHERE id = ?",
        (uid,)                          # tuple prevents SQL injection
    ).fetchone()

    if row is None:
        return jsonify({"error": "User not found"}), 404

    # ------------------------------------------------------------------
    # 4. Return the data
    # ------------------------------------------------------------------
    profile = {
        "id":       row["id"],
        "username": row["username"],
        "email":    row["email"],
        "role":     row["role"],
        "bio":      row["bio"],
    }
    return jsonify({"user": profile}), 200


# ---------------------------------------------------------------------------
# Dev-only token-generation endpoint (remove in production)
# ---------------------------------------------------------------------------

@app.route("/dev/token", methods=["POST"])
def dev_token():
    """
    POST /dev/token
    Body: {"user_id": 1, "role": "user"}

    Generates a JWT for manual testing.  **Remove this endpoint before
    deploying to production.**
    """
    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id")
    role    = data.get("role", "user")

    if not isinstance(user_id, int) or user_id <= 0:
        return jsonify({"error": "Provide a positive integer user_id"}), 400
    if role not in {"user", "admin"}:
        return jsonify({"error": "role must be 'user' or 'admin'"}), 400

    import datetime
    payload = {
        "user_id": user_id,
        "role":    role,
        "exp":     datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return jsonify({"token": token}), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    # Never use debug=True in production
    app.run(debug=True)