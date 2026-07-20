from flask import Flask, request, make_response, jsonify, current_app
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
import hmac

app = Flask(__name__)

# In-memory token store for demonstration only.
# In production, use a persistent database with proper indexing and expiry cleanup.
# Structure:
# {
#   "token_hash": {
#       "user_id": "123",
#       "created_at": datetime,
#       "last_used_at": datetime,
#       "expires_at": datetime
#   }
# }
REMEMBER_ME_TOKENS = {}

REMEMBER_ME_COOKIE_NAME = "remember_me"
REMEMBER_ME_DAYS = 30


def _utcnow():
    return datetime.now(timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_remember_me_token(user_id: str) -> str:
    """
    Create a new remember-me token, store only its hash server-side, and return the raw token.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    now = _utcnow()
    REMEMBER_ME_TOKENS[token_hash] = {
        "user_id": user_id,
        "created_at": now,
        "last_used_at": now,
        "expires_at": now + timedelta(days=REMEMBER_ME_DAYS),
    }
    return raw_token


def rotate_remember_me_token(old_raw_token: str) -> str | None:
    """
    Rotate an existing token: invalidate the old token and issue a new one for the same user.
    Returns the new raw token, or None if the old token is invalid/expired.
    """
    old_hash = _hash_token(old_raw_token)
    record = REMEMBER_ME_TOKENS.get(old_hash)
    now = _utcnow()

    if not record or record["expires_at"] <= now:
        if record:
            REMEMBER_ME_TOKENS.pop(old_hash, None)
        return None

    user_id = record["user_id"]

    # Remove old token before issuing a replacement to limit reuse window.
    REMEMBER_ME_TOKENS.pop(old_hash, None)

    new_raw_token = secrets.token_urlsafe(32)
    new_hash = _hash_token(new_raw_token)
    REMEMBER_ME_TOKENS[new_hash] = {
        "user_id": user_id,
        "created_at": now,
        "last_used_at": now,
        "expires_at": now + timedelta(days=REMEMBER_ME_DAYS),
    }
    return new_raw_token


def validate_and_rotate_remember_me_token(raw_token: str):
    """
    Validate a submitted remember-me token and rotate it on successful use.
    Returns (user_id, new_raw_token) or (None, None) if invalid.
    """
    token_hash = _hash_token(raw_token)
    record = REMEMBER_ME_TOKENS.get(token_hash)
    now = _utcnow()

    if not record or record["expires_at"] <= now:
        if record:
            REMEMBER_ME_TOKENS.pop(token_hash, None)
        return None, None

    # Constant-time compare for extra safety when dealing with hashes.
    if not hmac.compare_digest(token_hash, _hash_token(raw_token)):
        return None, None

    user_id = record["user_id"]

    # Rotate token: remove old, create new
    REMEMBER_ME_TOKENS.pop(token_hash, None)
    new_raw_token = secrets.token_urlsafe(32)
    new_hash = _hash_token(new_raw_token)
    REMEMBER_ME_TOKENS[new_hash] = {
        "user_id": user_id,
        "created_at": now,
        "last_used_at": now,
        "expires_at": now + timedelta(days=REMEMBER_ME_DAYS),
    }

    return user_id, new_raw_token


def set_remember_me_cookie(response, raw_token: str):
    """
    Set remember-me cookie with secure attributes.
    """
    response.set_cookie(
        REMEMBER_ME_COOKIE_NAME,
        raw_token,
        max_age=REMEMBER_ME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )
    return response


def clear_remember_me_cookie(response):
    response.delete_cookie(REMEMBER_ME_COOKIE_NAME, path="/")
    return response


@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint. Replace password verification with real authentication logic.
    If the user checks "remember me", issue a remember-me token.
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    remember_me = bool(data.get("remember_me"))

    # Replace this with real user lookup and password verification.
    if username != "demo" or password != "password":
        return jsonify({"error": "invalid credentials"}), 401

    user_id = "123"
    response = make_response(jsonify({"message": "logged in", "user_id": user_id}))
    if remember_me:
        token = create_remember_me_token(user_id)
        set_remember_me_cookie(response, token)
    return response


@app.route("/auto-login", methods=["POST", "GET"])
def auto_login():
    """
    Example endpoint that authenticates using remember-me cookie.
    If token is valid, it rotates the token and returns a fresh cookie.
    """
    raw_token = request.cookies.get(REMEMBER_ME_COOKIE_NAME)
    if not raw_token:
        return jsonify({"error": "no remember-me token"}), 401

    user_id, new_raw_token = validate_and_rotate_remember_me_token(raw_token)
    if not user_id:
        response = make_response(jsonify({"error": "invalid or expired remember-me token"}), 401)
        clear_remember_me_cookie(response)
        return response

    response = make_response(jsonify({"message": "authenticated via remember-me", "user_id": user_id}))
    set_remember_me_cookie(response, new_raw_token)
    return response


@app.route("/logout", methods=["POST"])
def logout():
    """
    Logout endpoint: clear cookie and invalidate any matching server-side token.
    """
    raw_token = request.cookies.get(REMEMBER_ME_COOKIE_NAME)
    if raw_token:
        token_hash = _hash_token(raw_token)
        REMEMBER_ME_TOKENS.pop(token_hash, None)

    response = make_response(jsonify({"message": "logged out"}))
    clear_remember_me_cookie(response)
    return response


if __name__ == "__main__":
    # In production, run behind HTTPS and ensure Flask knows it is behind a proxy if applicable.
    app.run(debug=True)