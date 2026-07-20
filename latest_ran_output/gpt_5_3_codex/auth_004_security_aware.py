from flask import Flask, request, jsonify, make_response, g
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

app = Flask(__name__)

# In production:
# - Use a persistent datastore (DB/Redis) instead of in-memory dicts.
# - Use HTTPS so Secure cookies are transmitted.
# - Set from environment/secret manager.
app.config["REMEMBER_COOKIE_NAME"] = "remember_me"
app.config["REMEMBER_DAYS"] = 30
app.config["SECRET_KEY"] = "replace-with-strong-secret"

# Demo user store
USERS = {
    "alice": {"id": 1, "username": "alice", "password": "password123"},
    "bob": {"id": 2, "username": "bob", "password": "password456"},
}
USERS_BY_ID = {u["id"]: u for u in USERS.values()}

# remember token store:
# key = sha256(token), value = {"user_id": int, "expires_at": datetime_utc}
REMEMBER_TOKENS = {}


def _utcnow():
    return datetime.now(timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_remember_token(user_id: int):
    token = secrets.token_urlsafe(48)
    token_hash = _hash_token(token)
    expires_at = _utcnow() + timedelta(days=app.config["REMEMBER_DAYS"])
    REMEMBER_TOKENS[token_hash] = {"user_id": user_id, "expires_at": expires_at}
    return token, expires_at


def _set_remember_cookie(resp, token: str, expires_at: datetime):
    resp.set_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        token,
        expires=expires_at,
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )


def _clear_remember_cookie(resp):
    resp.set_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        "",
        expires=0,
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )


def _authenticate_with_remember_cookie():
    """
    Returns user dict if remember cookie is valid.
    Rotates token on successful use:
      - old token invalidated
      - new token issued and must be set on response
    """
    raw_token = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    if not raw_token:
        return None, None, False  # user, new_token_data, should_clear_cookie

    token_hash = _hash_token(raw_token)
    record = REMEMBER_TOKENS.get(token_hash)
    if not record:
        return None, None, True

    if record["expires_at"] <= _utcnow():
        REMEMBER_TOKENS.pop(token_hash, None)
        return None, None, True

    user = USERS_BY_ID.get(record["user_id"])
    if not user:
        REMEMBER_TOKENS.pop(token_hash, None)
        return None, None, True

    # Rotate token to prevent replay/theft reuse
    REMEMBER_TOKENS.pop(token_hash, None)
    new_token, new_exp = _new_remember_token(user["id"])
    return user, (new_token, new_exp), False


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Example auth flow:
        # 1) session auth would go here (omitted for brevity)
        # 2) fallback to remember-me auth
        user, rotated, should_clear = _authenticate_with_remember_cookie()
        if not user:
            resp = jsonify({"error": "Unauthorized"})
            if should_clear:
                final_resp = make_response(resp, 401)
                _clear_remember_cookie(final_resp)
                return final_resp
            return make_response(resp, 401)

        g.current_user = user
        result = f(*args, **kwargs)

        # Normalize result into response object to set rotated cookie
        if isinstance(result, tuple):
            body, status = result[0], result[1]
            resp = make_response(body, status)
        else:
            resp = make_response(result)

        if rotated:
            new_token, new_exp = rotated
            _set_remember_cookie(resp, new_token, new_exp)
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

    resp = make_response(jsonify({"message": "Logged in"}), 200)

    if remember_me:
        token, exp = _new_remember_token(user["id"])
        _set_remember_cookie(resp, token, exp)

    return resp


@app.post("/logout")
def logout():
    raw_token = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    if raw_token:
        REMEMBER_TOKENS.pop(_hash_token(raw_token), None)

    resp = make_response(jsonify({"message": "Logged out"}), 200)
    _clear_remember_cookie(resp)
    return resp


@app.get("/protected")
@login_required
def protected():
    return jsonify({"message": f"Hello, {g.current_user['username']}!"}), 200


if __name__ == "__main__":
    app.run(debug=True)