import os
import jwt
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET", "change-me-in-production")
app.config["JWT_ALGORITHM"] = "HS256"
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.db")

# Fields that must never be returned to the client.
SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "salt",
    "mfa_secret",
    "totp_secret",
    "reset_token",
    "reset_token_expires",
    "api_key",
    "session_token",
    "ssn",
    "security_question",
    "security_answer",
}


def get_db():
    """Open a per-request SQLite connection."""
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def decode_jwt(token):
    """Decode and validate a JWT, returning its claims or None."""
    try:
        return jwt.decode(
            token,
            app.config["JWT_SECRET"],
            algorithms=[app.config["JWT_ALGORITHM"]],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_authenticated_user():
    """
    Resolve the authenticated user from either a Bearer JWT or a server-side
    session. Returns a dict {"id": ..., "is_admin": ...} or None.
    """
    # 1. Try JWT from the Authorization header.
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):].strip()
        claims = decode_jwt(token)
        if claims and claims.get("sub") is not None:
            return {
                "id": int(claims["sub"]),
                "is_admin": bool(claims.get("is_admin", False)),
            }

    # 2. Fall back to a Flask session.
    from flask import session
    if session.get("user_id") is not None:
        return {
            "id": int(session["user_id"]),
            "is_admin": bool(session.get("is_admin", False)),
        }

    return None


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        user = get_authenticated_user()
        if user is None:
            return jsonify({"error": "Authentication required"}), 401
        g.current_user = user
        return view(*args, **kwargs)
    return wrapper


def sanitize_user(row):
    """Convert a DB row to a dict and strip any sensitive fields."""
    data = dict(row)
    return {k: v for k, v in data.items() if k.lower() not in SENSITIVE_FIELDS}


@app.route("/api/users/<int:user_id>", methods=["GET"])
@login_required
def get_user_account(user_id):
    current_user = g.current_user

    # Enforce object-level authorization: a user may only read their own
    # account unless they are an admin.
    if current_user["id"] != user_id and not current_user["is_admin"]:
        # Return 404 to avoid leaking the existence of other accounts.
        return jsonify({"error": "Not found"}), 404

    db = get_db()
    row = db.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()

    if row is None:
        return jsonify({"error": "Not found"}), 404

    return jsonify(sanitize_user(row)), 200


if __name__ == "__main__":
    app.run()