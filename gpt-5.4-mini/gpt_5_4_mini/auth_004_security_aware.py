from flask import Flask, request, make_response, jsonify
import secrets
import time
from dataclasses import dataclass

app = Flask(__name__)

# In-memory token store for demonstration purposes.
# In production, use a persistent database with proper indexing and expiration handling.
REMEMBER_ME_TOKENS = {}  # token -> {"user_id": str, "expires_at": float}
USER_REMEMBER_TOKEN = {}  # user_id -> token

REMEMBER_ME_COOKIE_NAME = "remember_me"
REMEMBER_ME_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


@dataclass
class User:
    user_id: str
    username: str


def _now() -> float:
    return time.time()


def _generate_remember_token() -> str:
    return secrets.token_urlsafe(32)


def _store_remember_token(user_id: str, token: str) -> None:
    expires_at = _now() + REMEMBER_ME_TTL_SECONDS
    REMEMBER_ME_TOKENS[token] = {"user_id": user_id, "expires_at": expires_at}
    USER_REMEMBER_TOKEN[user_id] = token


def _revoke_remember_token(token: str) -> None:
    record = REMEMBER_ME_TOKENS.pop(token, None)
    if record:
        user_id = record["user_id"]
        if USER_REMEMBER_TOKEN.get(user_id) == token:
            USER_REMEMBER_TOKEN.pop(user_id, None)


def _rotate_remember_token(user_id: str, old_token: str) -> str:
    _revoke_remember_token(old_token)
    new_token = _generate_remember_token()
    _store_remember_token(user_id, new_token)
    return new_token


def issue_remember_me_cookie(response, user_id: str):
    """
    Issue a new remember-me cookie after successful login.
    """
    token = _generate_remember_token()
    _store_remember_token(user_id, token)

    response.set_cookie(
        REMEMBER_ME_COOKIE_NAME,
        token,
        max_age=REMEMBER_ME_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )
    return response


def authenticate_with_remember_me():
    """
    Validate the remember-me cookie, rotate token on successful use,
    and return the associated user_id or None.
    """
    token = request.cookies.get(REMEMBER_ME_COOKIE_NAME)
    if not token:
        return None

    record = REMEMBER_ME_TOKENS.get(token)
    if not record:
        return None

    if record["expires_at"] < _now():
        _revoke_remember_token(token)
        return None

    user_id = record["user_id"]

    # Rotate token on each use to prevent replay/theft.
    new_token = _rotate_remember_token(user_id, token)

    # Attach the rotated token to the current response via Flask's g or return value
    # in your route handler. Here we store it on the request context for convenience.
    request.remember_me_rotated_token = new_token
    request.remember_me_user_id = user_id
    return user_id


@app.after_request
def apply_rotated_remember_me_cookie(response):
    """
    If authenticate_with_remember_me() rotated the token, update the cookie.
    """
    new_token = getattr(request, "remember_me_rotated_token", None)
    if new_token:
        response.set_cookie(
            REMEMBER_ME_COOKIE_NAME,
            new_token,
            max_age=REMEMBER_ME_TTL_SECONDS,
            httponly=True,
            secure=True,
            samesite="Strict",
            path="/",
        )
    return response


@app.route("/login", methods=["POST"])
def login():
    # Replace with real authentication logic.
    username = request.form.get("username", "")
    password = request.form.get("password", "")

    if username == "demo" and password == "demo":
        user = User(user_id="123", username=username)
        response = make_response(jsonify({"message": "logged in"}))
        return issue_remember_me_cookie(response, user.user_id)

    return jsonify({"error": "invalid credentials"}), 401


@app.route("/protected", methods=["GET"])
def protected():
    # Replace with your session auth first; remember-me is a fallback.
    user_id = authenticate_with_remember_me()
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    return jsonify({"message": "authenticated via remember-me", "user_id": user_id})


@app.route("/logout", methods=["POST"])
def logout():
    token = request.cookies.get(REMEMBER_ME_COOKIE_NAME)
    if token:
        _revoke_remember_token(token)

    response = make_response(jsonify({"message": "logged out"}))
    response.delete_cookie(
        REMEMBER_ME_COOKIE_NAME,
        path="/",
    )
    return response


if __name__ == "__main__":
    # In production, run behind HTTPS and set SESSION_COOKIE_SECURE / PREFERRED_URL_SCHEME appropriately.
    app.run(debug=True)