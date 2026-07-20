import secrets
import hashlib
import time
from functools import wraps
from flask import Flask, request, make_response, g, jsonify

app = Flask(__name__)

# --- Configuration ---
REMEMBER_COOKIE_NAME = "remember_token"
REMEMBER_TOKEN_TTL = 60 * 60 * 24 * 30  # 30 days in seconds

# --- In-memory server-side token store (replace with DB in production) ---
# Structure: token_hash -> {"user_id": ..., "expires_at": ...}
_remember_tokens = {}


def _hash_token(raw_token: str) -> str:
    """Hash the token before storing so a store leak doesn't expose valid tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _store_remember_token(user_id) -> str:
    """Generate a new random remember-me token, store its hash, return raw token."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    _remember_tokens[token_hash] = {
        "user_id": user_id,
        "expires_at": int(time.time()) + REMEMBER_TOKEN_TTL,
    }
    return raw_token


def _revoke_remember_token(raw_token: str) -> None:
    """Delete a token from the server-side store."""
    if not raw_token:
        return
    _remember_tokens.pop(_hash_token(raw_token), None)


def _lookup_remember_token(raw_token: str):
    """Validate a token; return user_id if valid and not expired, else None."""
    if not raw_token:
        return None
    token_hash = _hash_token(raw_token)
    entry = _remember_tokens.get(token_hash)
    if entry is None:
        return None
    if entry["expires_at"] < int(time.time()):
        # Expired: clean up
        _remember_tokens.pop(token_hash, None)
        return None
    return entry["user_id"]


def _set_remember_cookie(response, raw_token: str):
    """Attach the remember-me cookie with secure attributes."""
    response.set_cookie(
        REMEMBER_COOKIE_NAME,
        raw_token,
        max_age=REMEMBER_TOKEN_TTL,
        httponly=True,      # inaccessible to JavaScript
        secure=True,        # only sent over HTTPS
        samesite="Strict",  # not sent on cross-site requests
        path="/",
    )
    return response


def _clear_remember_cookie(response):
    response.delete_cookie(REMEMBER_COOKIE_NAME, path="/", samesite="Strict")
    return response


def issue_remember_me(response, user_id):
    """Call after successful login when 'remember me' is checked."""
    raw_token = _store_remember_token(user_id)
    return _set_remember_cookie(response, raw_token)


def remember_me_middleware():
    """
    Validates the remember-me cookie, rotates the token on each successful use,
    and re-authenticates the user. Attach the rotated cookie via g._new_remember_token.
    """
    g.user_id = None
    g._new_remember_token = None
    g._clear_remember = False

    raw_token = request.cookies.get(REMEMBER_COOKIE_NAME)
    if not raw_token:
        return

    user_id = _lookup_remember_token(raw_token)
    if user_id is None:
        # Invalid/expired/stolen-and-rotated token: clear it.
        g._clear_remember = True
        return

    # Rotate: revoke the used token and issue a fresh one.
    _revoke_remember_token(raw_token)
    g._new_remember_token = _store_remember_token(user_id)
    g.user_id = user_id


@app.before_request
def _before():
    remember_me_middleware()


@app.after_request
def _after(response):
    """Apply any token rotation / clearing decided during the request."""
    if getattr(g, "_new_remember_token", None):
        _set_remember_cookie(response, g._new_remember_token)
    elif getattr(g, "_clear_remember", False):
        _clear_remember_cookie(response)
    return response


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if getattr(g, "user_id", None) is None:
            return jsonify({"error": "authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper


# --- Example routes ---
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    # NOTE: verify credentials properly (e.g. bcrypt) before this point.
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "invalid credentials"}), 401

    resp = make_response(jsonify({"message": "logged in", "user_id": user_id}))
    if data.get("remember_me"):
        issue_remember_me(resp, user_id)
    return resp


@app.route("/logout", methods=["POST"])
def logout():
    raw_token = request.cookies.get(REMEMBER_COOKIE_NAME)
    _revoke_remember_token(raw_token)
    resp = make_response(jsonify({"message": "logged out"}))
    return _clear_remember_cookie(resp)


@app.route("/profile", methods=["GET"])
@login_required
def profile():
    return jsonify({"user_id": g.user_id})


if __name__ == "__main__":
    app.run(ssl_context="adhoc")