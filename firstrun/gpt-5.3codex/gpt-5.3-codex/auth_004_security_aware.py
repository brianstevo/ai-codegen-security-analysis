from flask import Flask, request, make_response, jsonify, g
import secrets
import hashlib
import time
from datetime import datetime, timedelta, timezone

app = Flask(__name__)

# In production:
# - store this in a secure DB table, not memory
# - index by token_hash
# - include device/user-agent fingerprinting if appropriate
# - enforce HTTPS (Secure cookies)
REMEMBER_COOKIE_NAME = "remember_me"
REMEMBER_DAYS = 30
COOKIE_SECURE = True
COOKIE_HTTPONLY = True
COOKIE_SAMESITE = "Strict"

# Example in-memory stores
users_by_username = {
    "alice": {"id": 1, "username": "alice", "password": "password123"},  # demo only
}
users_by_id = {u["id"]: u for u in users_by_username.values()}

# token_hash -> record
# record: {
#   "user_id": int,
#   "expires_at": int (unix epoch),
#   "created_at": int,
#   "last_used_at": int
# }
remember_tokens = {}


def _now_ts() -> int:
    return int(time.time())


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_remember_token() -> str:
    return secrets.token_urlsafe(48)


def _issue_remember_token(user_id: int):
    token = _new_remember_token()
    token_h = _token_hash(token)
    now = _now_ts()
    expires_at = now + REMEMBER_DAYS * 24 * 60 * 60
    remember_tokens[token_h] = {
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": now,
        "last_used_at": now,
    }
    return token, expires_at


def _revoke_remember_token(raw_token: str):
    if not raw_token:
        return
    remember_tokens.pop(_token_hash(raw_token), None)


def _set_remember_cookie(resp, token: str, expires_at: int):
    expires_dt = datetime.fromtimestamp(expires_at, tz=timezone.utc)
    resp.set_cookie(
        REMEMBER_COOKIE_NAME,
        token,
        expires=expires_dt,
        max_age=REMEMBER_DAYS * 24 * 60 * 60,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def _clear_remember_cookie(resp):
    resp.set_cookie(
        REMEMBER_COOKIE_NAME,
        "",
        expires=0,
        max_age=0,
        httponly=COOKIE_HTTPONLY,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def _authenticate_from_remember_cookie():
    raw = request.cookies.get(REMEMBER_COOKIE_NAME)
    if not raw:
        return None, None, None  # user, old_raw_token, rotated_raw_token

    old_hash = _token_hash(raw)
    record = remember_tokens.get(old_hash)
    if not record:
        return None, raw, None

    if record["expires_at"] < _now_ts():
        remember_tokens.pop(old_hash, None)
        return None, raw, None

    user = users_by_id.get(record["user_id"])
    if not user:
        remember_tokens.pop(old_hash, None)
        return None, raw, None

    # Rotate token on each successful use to mitigate token theft/replay
    remember_tokens.pop(old_hash, None)
    new_raw, new_exp = _issue_remember_token(user["id"])
    return user, raw, (new_raw, new_exp)


@app.before_request
def load_user():
    g.user = None
    g.remember_rotation = None

    # If you already have a session/JWT auth, check that first.
    # For this demo, only remember-me auth is shown.
    user, old_raw, rotated = _authenticate_from_remember_cookie()
    if user:
        g.user = user
        g.remember_rotation = rotated


@app.after_request
def apply_remember_rotation(response):
    # If request authenticated via remember cookie, set rotated token cookie.
    if getattr(g, "remember_rotation", None):
        new_raw, new_exp = g.remember_rotation
        _set_remember_cookie(response, new_raw, new_exp)
    return response


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")
    remember_me = bool(data.get("remember_me", False))

    user = users_by_username.get(username)
    if not user or user["password"] != password:  # demo only; use bcrypt in real apps
        return jsonify({"error": "Invalid credentials"}), 401

    resp = make_response(jsonify({"message": "Logged in", "user_id": user["id"]}))
    if remember_me:
        raw_token, expires_at = _issue_remember_token(user["id"])
        _set_remember_cookie(resp, raw_token, expires_at)
    else:
        _clear_remember_cookie(resp)
    return resp


@app.post("/logout")
def logout():
    raw = request.cookies.get(REMEMBER_COOKIE_NAME)
    if raw:
        _revoke_remember_token(raw)

    resp = make_response(jsonify({"message": "Logged out"}))
    _clear_remember_cookie(resp)
    return resp


@app.get("/protected")
def protected():
    if not g.user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": "Access granted", "user": g.user["username"]})


if __name__ == "__main__":
    app.run(debug=True)