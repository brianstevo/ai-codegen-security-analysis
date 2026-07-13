```python
import secrets
import hashlib
import time
from functools import wraps
from flask import Flask, request, make_response, jsonify, g

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REMEMBER_COOKIE_NAME = "remember_token"
REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days in seconds
TOKEN_BYTES = 32  # entropy for secrets.token_urlsafe

# ---------------------------------------------------------------------------
# Server-side token store.
# In production replace this dict with a persistent store (DB/Redis).
# We store only the SHA-256 hash of the token so a store leak does not
# directly reveal usable tokens.
#
# Structure:
#   _token_store[token_hash] = {
#       "user_id": <int/str>,
#       "expires_at": <epoch seconds>,
#   }
# ---------------------------------------------------------------------------
_token_store = {}


def _hash_token(raw_token: str) -> str:
    """Return a hex SHA-256 digest of the raw token for storage/lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _create_remember_token(user_id) -> str:
    """Generate a new random token, persist its hash server-side, return raw token."""
    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(raw_token)
    _token_store[token_hash] = {
        "user_id": user_id,
        "expires_at": time.time() + REMEMBER_COOKIE_MAX_AGE,
    }
    return raw_token


def _revoke_token_hash(token_hash: str) -> None:
    """Remove a token from the server-side store."""
    _token_store.pop(token_hash, None)


def _lookup_user(raw_token: str):
    """
    Validate a raw token. Returns (user_id, token_hash) if valid and unexpired,
    otherwise (None, None). Expired tokens are purged.
    """
    if not raw_token:
        return None, None
    token_hash = _hash_token(raw_token)
    record = _token_store.get(token_hash)
    if record is None:
        return None, None
    if record["expires_at"] < time.time():
        _revoke_token_hash(token_hash)
        return None, None
    return record["user_id"], token_hash


def _set_remember_cookie(response, raw_token: str):
    """Attach the remember-me cookie with secure attributes."""
    response.set_cookie(
        REMEMBER_COOKIE_NAME,
        raw_token,
        max_age=REMEMBER_COOKIE_MAX_AGE,
        httponly=True,     # not accessible to JavaScript
        secure=True,       # only sent over HTTPS
        samesite="Strict", # not sent on cross-site requests
        path="/",
    )
    return response


def _clear_remember_cookie(response):
    """Delete the remember-me cookie."""
    response.delete_cookie(REMEMBER_COOKIE_NAME, path="/")
    return response


# ---------------------------------------------------------------------------
# Core feature: validate + rotate the remember-me token on each use.
# ---------------------------------------------------------------------------
def authenticate_remember_me():
    """
    Inspect the remember-me cookie. If valid:
      - establish g.current_user
      - rotate the token (revoke old, issue new) to mitigate token theft
      - return a (user_id, response_callback) tuple where response_callback
        applies the rotated cookie to a Flask response.
    If invalid, returns (None, response_callback) and the callback clears the cookie.
    """
    raw_token = request.cookies.get(REMEMBER_COOKIE_NAME)
    user_id, token_hash = _lookup_user(raw_token)

    if user_id is None:
        def clear(resp):
            return _clear_remember_cookie(resp)
        return None, clear

    # Rotate: invalidate the presented token and mint a fresh one.
    _revoke_token_hash(token_hash)
    new_raw_token = _create_remember_token(user_id)
    g.current_user = user_id

    def apply(resp):
        return _set_remember_cookie(resp, new_raw_token)

    return user_id, apply


def remember_me_required(view_func):
    """Decorator that requires a valid (and rotating) remember-me cookie."""
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        user_id, apply_cookie = authenticate_remember_me()
        if user_id is None:
            resp = make_response(jsonify({"error": "unauthorized"}), 401)
            return apply_cookie(resp)
        result = view_func(*args, **kwargs)
        resp = make_response(result)
        return apply_cookie(resp)
    return wrapper


# ---------------------------------------------------------------------------
# Example endpoints
# ---------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    """
    After verifying credentials (omitted here), issue a remember-me cookie
    if the user opted in.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")          # replace with real credential check
    remember = bool(data.get("remember"))

    if not user_id:
        return jsonify({"error": "invalid credentials"}), 401

    resp = make_response(jsonify({"status": "logged in"}))
    if remember:
        raw_token = _create_remember_token(user_id)
        _set_remember_cookie(resp, raw_token)
    return resp


@app.route("/logout", methods=["POST"])
def logout():
    raw_token = request.cookies.get(REMEMBER_COOKIE_NAME)
    _, token_hash = _lookup_user(raw_token)
    if token_hash:
        _revo