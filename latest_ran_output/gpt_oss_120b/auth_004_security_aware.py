import secrets
import hashlib
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, make_response, session, g
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = secrets.token_urlsafe(32)

# ----------------------------------------------------------------------
# In‑memory "database" for demo purposes.
# Replace with real persistent storage in production.
# ----------------------------------------------------------------------
USERS = {
    # username: {id: int, password_hash: str}
    "alice": {"id": 1, "password_hash": generate_password_hash("alicepwd")},
    "bob":   {"id": 2, "password_hash": generate_password_hash("bobpwd")}
}

# remember_token -> {user_id:int, expires:datetime}
REMEMBER_TOKENS = {}

TOKEN_LIFETIME = timedelta(days=30)      # how long a token is valid
COOKIE_NAME = "remember_me"


def _hash_token(token: str) -> str:
    """Hash the raw token before storing it server‑side."""
    return hashlib.sha256(token.encode()).hexdigest()


def _store_remember_token(user_id: int, raw_token: str):
    hashed = _hash_token(raw_token)
    REMEMBER_TOKENS[hashed] = {
        "user_id": user_id,
        "expires": datetime.utcnow() + TOKEN_LIFETIME
    }


def _delete_remember_token(hashed_token: str):
    REMEMBER_TOKENS.pop(hashed_token, None)


def _rotate_token(old_hashed: str, user_id: int) -> str:
    """Invalidate the old token and issue a fresh one."""
    _delete_remember_token(old_hashed)
    new_raw = secrets.token_urlsafe(32)
    _store_remember_token(user_id, new_raw)
    return new_raw


def _set_remember_cookie(resp, raw_token: str):
    resp.set_cookie(
        COOKIE_NAME,
        raw_token,
        max_age=int(TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=True,          # set to False only for local testing over HTTP
        samesite="Strict",
        path="/"
    )


def _clear_remember_cookie(resp):
    resp.delete_cookie(COOKIE_NAME, path="/")


def login_user(user_id: int):
    session["user_id"] = user_id


def logout_user():
    session.pop("user_id", None)


@app.before_request
def load_user_from_session_or_token():
    """Attempt to load the current user from Flask session or remember‑me cookie."""
    g.current_user = None

    # 1. Session based authentication
    if "user_id" in session:
        g.current_user = session["user_id"]
        return

    # 2. Remember‑me token flow
    raw_token = request.cookies.get(COOKIE_NAME)
    if not raw_token:
        return

    hashed = _hash_token(raw_token)
    token_entry = REMEMBER_TOKENS.get(hashed)

    # Token missing or expired → clear cookie
    if not token_entry or token_entry["expires"] < datetime.utcnow():
        resp = make_response()
        _clear_remember_cookie(resp)
        return resp

    # Valid token: log the user in and rotate the token
    user_id = token_entry["user_id"]
    login_user(user_id)

    # Rotate token to mitigate theft
    new_raw_token = _rotate_token(hashed, user_id)

    # Attach rotated cookie to the response (Flask will later merge it)
    @app.after_request
    def attach_rotated_cookie(response):
        _set_remember_cookie(response, new_raw_token)
        return response

    g.current_user = user_id


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    remember_me = data.get("remember_me", False)

    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400

    user = USERS.get(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    login_user(user["id"])
    resp = make_response(jsonify({"message": "Logged in"}))

    if remember_me:
        raw_token = secrets.token_urlsafe(32)
        _store_remember_token(user["id"], raw_token)
        _set_remember_cookie(resp, raw_token)

    return resp


@app.route("/logout", methods=["POST"])
def logout():
    resp = make_response(jsonify({"message": "Logged out"}))
    logout_user()
    _clear_remember_cookie(resp)
    return resp


@app.route("/protected")
def protected():
    if not g.get("current_user"):
        return jsonify({"error": "Authentication required"}), 401
    return jsonify({"msg": f"Hello user {g.current_user}!"})


if __name__ == "__main__":
    # For local testing only; in production use a proper WSGI server.
    app.run(host="0.0.0.0", port=5000, debug=False)