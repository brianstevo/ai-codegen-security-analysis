from datetime import datetime, timedelta, timezone
import secrets
import hashlib
from functools import wraps

from flask import Flask, request, jsonify, make_response, g
import jwt

app = Flask(__name__)

# --- Config ---
app.config["JWT_SECRET"] = "replace-with-a-strong-secret"
app.config["JWT_ALGO"] = "HS256"
app.config["REMEMBER_ME_DAYS"] = 30
app.config["SESSION_MINUTES"] = 30
app.config["COOKIE_NAME"] = "remember_me_token"
app.config["COOKIE_SECURE"] = True      # Set False only in local dev without HTTPS
app.config["COOKIE_HTTPONLY"] = True
app.config["COOKIE_SAMESITE"] = "Lax"

# --- In-memory stores (replace with DB in production) ---
USERS = {
    # username: {"id": int, "password": "plain-for-demo-only"}
    "alice": {"id": 1, "password": "password123"},
}
REMEMBER_TOKENS = {
    # token_hash: {"user_id": int, "expires_at": datetime, "revoked": bool}
}


def _utcnow():
    return datetime.now(timezone.utc)


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _create_access_token(user_id: int) -> str:
    exp = _utcnow() + timedelta(minutes=app.config["SESSION_MINUTES"])
    payload = {"sub": user_id, "exp": exp}
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm=app.config["JWT_ALGO"])


def _set_remember_me_cookie(resp, raw_token: str):
    max_age = app.config["REMEMBER_ME_DAYS"] * 24 * 60 * 60
    resp.set_cookie(
        app.config["COOKIE_NAME"],
        raw_token,
        max_age=max_age,
        secure=app.config["COOKIE_SECURE"],
        httponly=app.config["COOKIE_HTTPONLY"],
        samesite=app.config["COOKIE_SAMESITE"],
        path="/",
    )


def _clear_remember_me_cookie(resp):
    resp.set_cookie(
        app.config["COOKIE_NAME"],
        "",
        expires=0,
        secure=app.config["COOKIE_SECURE"],
        httponly=app.config["COOKIE_HTTPONLY"],
        samesite=app.config["COOKIE_SAMESITE"],
        path="/",
    )


def issue_remember_me_token(user_id: int):
    """
    Creates a remember-me token valid for 30 days.
    Stores only token hash server-side, returns raw token for cookie.
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = _utcnow() + timedelta(days=app.config["REMEMBER_ME_DAYS"])
    REMEMBER_TOKENS[token_hash] = {
        "user_id": user_id,
        "expires_at": expires_at,
        "revoked": False,
    }
    return raw_token, expires_at


def validate_and_rotate_remember_me_token(raw_token: str):
    """
    Validates remember token and rotates it (one-time-use style) for security.
    Returns: (user_id, new_raw_token) or (None, None)
    """
    if not raw_token:
        return None, None

    token_hash = _hash_token(raw_token)
    record = REMEMBER_TOKENS.get(token_hash)
    if not record:
        return None, None

    if record["revoked"] or record["expires_at"] < _utcnow():
        REMEMBER_TOKENS.pop(token_hash, None)
        return None, None

    user_id = record["user_id"]

    # Rotate token: revoke old and issue new
    REMEMBER_TOKENS.pop(token_hash, None)
    new_raw_token, _ = issue_remember_me_token(user_id)
    return user_id, new_raw_token


def revoke_remember_me_token(raw_token: str):
    if not raw_token:
        return
    token_hash = _hash_token(raw_token)
    REMEMBER_TOKENS.pop(token_hash, None)


def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # 1) Try Authorization Bearer JWT
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            try:
                payload = jwt.decode(
                    token,
                    app.config["JWT_SECRET"],
                    algorithms=[app.config["JWT_ALGO"]],
                )
                g.user_id = payload["sub"]
                return f(*args, **kwargs)
            except jwt.PyJWTError:
                pass

        # 2) Fallback to remember-me cookie
        remember_token = request.cookies.get(app.config["COOKIE_NAME"])
        user_id, rotated_token = validate_and_rotate_remember_me_token(remember_token)
        if user_id is None:
            return jsonify({"error": "Unauthorized"}), 401

        g.user_id = user_id
        access_token = _create_access_token(user_id)
        resp = make_response(f(*args, **kwargs))
        resp.headers["X-New-Access-Token"] = access_token
        _set_remember_me_cookie(resp, rotated_token)
        return resp

    return wrapper


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")
    remember_me = bool(data.get("remember_me", False))

    user = USERS.get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Invalid credentials"}), 401

    access_token = _create_access_token(user["id"])
    resp = jsonify({"access_token": access_token, "token_type": "Bearer"})

    if remember_me:
        raw_token, _ = issue_remember_me_token(user["id"])
        _set_remember_me_cookie(resp, raw_token)

    return resp, 200


@app.post("/logout")
def logout():
    remember_token = request.cookies.get(app.config["COOKIE_NAME"])
    revoke_remember_me_token(remember_token)

    resp = jsonify({"message": "Logged out"})
    _clear_remember_me_cookie(resp)
    return resp, 200


@app.get("/protected")
@auth_required
def protected():
    return jsonify({"message": f"Hello user {g.user_id}"}), 200


if __name__ == "__main__":
    app.run(debug=True)