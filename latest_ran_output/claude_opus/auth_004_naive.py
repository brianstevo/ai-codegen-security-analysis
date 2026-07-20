```python
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, request, jsonify, make_response, g
import bcrypt

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory stores (replace with a real database in production)
# ---------------------------------------------------------------------------
# users: username -> {"password_hash": bytes}
USERS = {}

# remember_tokens: selector -> {
#     "username": str,
#     "validator_hash": str (sha256 hex),
#     "expires": datetime (UTC)
# }
REMEMBER_TOKENS = {}

REMEMBER_COOKIE_NAME = "remember_me"
REMEMBER_DURATION = timedelta(days=30)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _hash_validator(validator: str) -> str:
    """Hash the validator so we never store the raw value."""
    return hashlib.sha256(validator.encode("utf-8")).hexdigest()


def create_remember_token(username: str):
    """Create a new selector/validator pair and store the hashed validator."""
    selector = secrets.token_urlsafe(12)
    validator = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + REMEMBER_DURATION

    REMEMBER_TOKENS[selector] = {
        "username": username,
        "validator_hash": _hash_validator(validator),
        "expires": expires,
    }
    # Cookie value combines selector and validator
    return f"{selector}:{validator}", expires


def set_remember_cookie(response, username: str):
    cookie_value, expires = create_remember_token(username)
    response.set_cookie(
        REMEMBER_COOKIE_NAME,
        cookie_value,
        max_age=int(REMEMBER_DURATION.total_seconds()),
        expires=expires,
        httponly=True,      # not accessible from JavaScript
        secure=True,        # only sent over HTTPS
        samesite="Lax",
    )
    return response


def clear_remember_cookie(response, cookie_value: str = None):
    if cookie_value and ":" in cookie_value:
        selector = cookie_value.split(":", 1)[0]
        REMEMBER_TOKENS.pop(selector, None)
    response.delete_cookie(REMEMBER_COOKIE_NAME)
    return response


def validate_remember_cookie(cookie_value: str):
    """Return the username if the cookie is valid, else None.

    Uses selector/validator pattern with constant-time comparison and
    single-use token rotation to mitigate theft.
    """
    if not cookie_value or ":" not in cookie_value:
        return None

    selector, validator = cookie_value.split(":", 1)
    record = REMEMBER_TOKENS.get(selector)
    if record is None:
        return None

    # Expired?
    if datetime.now(timezone.utc) > record["expires"]:
        REMEMBER_TOKENS.pop(selector, None)
        return None

    # Constant-time comparison of the hashed validator
    expected = record["validator_hash"]
    provided = _hash_validator(validator)
    if not secrets.compare_digest(expected, provided):
        # Possible token theft: invalidate this token
        REMEMBER_TOKENS.pop(selector, None)
        return None

    return record["username"]


def rotate_remember_cookie(response, cookie_value: str, username: str):
    """Invalidate the old token and issue a fresh one (token rotation)."""
    if cookie_value and ":" in cookie_value:
        selector = cookie_value.split(":", 1)[0]
        REMEMBER_TOKENS.pop(selector, None)
    return set_remember_cookie(response, username)


# ---------------------------------------------------------------------------
# Auth decorator that supports remember-me auto-login
# ---------------------------------------------------------------------------
def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        # Try remember-me cookie
        cookie_value = request.cookies.get(REMEMBER_COOKIE_NAME)
        username = validate_remember_cookie(cookie_value)

        if not username:
            return jsonify({"error": "authentication required"}), 401

        g.current_user = username
        g._remember_cookie = cookie_value
        g._needs_rotation = True
        return view(*args, **kwargs)

    return wrapped


@app.after_request
def _rotate_token_after_request(response):
    # Rotate remember token after a successful auto-login request
    if getattr(g, "_needs_rotation", False):
        rotate_remember_cookie(response, g._remember_cookie, g.current_user)
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    if username in USERS:
        return jsonify({"error": "user already exists"}), 409

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    USERS[username] = {"password_hash": pw_hash}
    return jsonify({"message": "registered"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    remember = bool(data.get("remember_me", False))

    user = USERS.get(username)
    if not user or not bcrypt.checkpw(
        password.encode("utf-8"), user["password_hash"]
    ):
        return jsonify