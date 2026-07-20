from flask import Flask, request, jsonify, make_response, session, g
import os
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# In production, replace this with a real database.
# Structure:
# {
#   "username": {
#       "password_hash": "...",
#       "remember_hash": "...",
#       "remember_expires_at": datetime(..., tzinfo=timezone.utc)
#   }
# }
USERS = {}


def utcnow():
    return datetime.now(timezone.utc)


def hash_remember_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_remember_me_token(username: str):
    """
    Create a 30-day remember-me token and store only its hash server-side.
    Returns the raw token to be sent to the client in a secure cookie.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_remember_token(raw_token)

    USERS[username]["remember_hash"] = token_hash
    USERS[username]["remember_expires_at"] = utcnow() + timedelta(days=30)

    return raw_token


def set_remember_me_cookie(resp, raw_token: str):
    resp.set_cookie(
        "remember_me",
        raw_token,
        max_age=30 * 24 * 60 * 60,  # 30 days
        httponly=True,
        secure=True,      # require HTTPS in production
        samesite="Lax",
        path="/",
    )
    return resp


def clear_remember_me_cookie(resp):
    resp.delete_cookie("remember_me", path="/")
    return resp


def login_user(username: str, remember_me: bool = False):
    session["user"] = username
    resp = make_response(jsonify({"message": "logged in", "user": username}))

    if remember_me:
        raw_token = create_remember_me_token(username)
        set_remember_me_cookie(resp, raw_token)

    return resp


@app.before_request
def load_user_from_session_or_remember_me():
    # If already logged in via session, nothing to do.
    if session.get("user"):
        g.user = session["user"]
        return

    g.user = None

    # Try remember-me cookie
    raw_token = request.cookies.get("remember_me")
    if not raw_token:
        return

    token_hash = hash_remember_token(raw_token)
    now = utcnow()

    for username, data in USERS.items():
        stored_hash = data.get("remember_hash")
        expires_at = data.get("remember_expires_at")

        if not stored_hash or not expires_at:
            continue

        if expires_at < now:
            continue

        if hmac.compare_digest(stored_hash, token_hash):
            session["user"] = username
            g.user = username
            # Optional: rotate token on successful use to reduce replay risk
            new_raw_token = create_remember_me_token(username)
            # We cannot directly set cookies in before_request, so stash it on g.
            g.rotate_remember_cookie = new_raw_token
            return


@app.after_request
def apply_rotated_remember_cookie(resp):
    new_raw_token = getattr(g, "rotate_remember_cookie", None)
    if new_raw_token:
        set_remember_me_cookie(resp, new_raw_token)
    return resp


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("user"):
            return jsonify({"error": "authentication required"}), 401
        return fn(*args, **kwargs)
    return wrapper


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    remember_me = bool(data.get("remember_me", False))

    user = USERS.get(username)
    if not user:
        return jsonify({"error": "invalid credentials"}), 401

    # Replace with bcrypt.checkpw in a real app.
    password_ok = hmac.compare_digest(
        user.get("password_hash", ""),
        hashlib.sha256(password.encode("utf-8")).hexdigest(),
    )
    if not password_ok:
        return jsonify({"error": "invalid credentials"}), 401

    return login_user(username, remember_me=remember_me)


@app.route("/logout", methods=["POST"])
def logout():
    username = session.pop("user", None)

    resp = make_response(jsonify({"message": "logged out"}))
    clear_remember_me_cookie(resp)

    if username and username in USERS:
        USERS[username]["remember_hash"] = None
        USERS[username]["remember_expires_at"] = None

    return resp


@app.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user": session["user"]})


# Example helper to create users in-memory for testing.
def create_user(username: str, password: str):
    USERS[username] = {
        "password_hash": hashlib.sha256(password.encode("utf-8")).hexdigest(),
        "remember_hash": None,
        "remember_expires_at": None,
    }


if __name__ == "__main__":
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=True,  # require HTTPS in production
        SESSION_COOKIE_SAMESITE="Lax",
        PERMANENT_SESSION_LIFETIME=timedelta(days=30),
    )
    create_user("alice", "password123")
    app.run(debug=True)