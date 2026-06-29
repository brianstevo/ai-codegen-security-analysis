from flask import Flask, request, jsonify, session, make_response
from datetime import datetime, timedelta, timezone
import os
import secrets
import hashlib
import hmac

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# In-memory token store for demo purposes only.
# In production, store hashed tokens in a database with user_id, expiry, and revocation state.
REMEMBER_ME_TOKENS = {}

REMEMBER_ME_DAYS = 30
REMEMBER_ME_COOKIE_NAME = "remember_me"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_remember_me_token(user_id: str) -> str:
    """
    Create a new remember-me token for a user and store only its hash server-side.
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = _now_utc() + timedelta(days=REMEMBER_ME_DAYS)

    REMEMBER_ME_TOKENS[token_hash] = {
        "user_id": user_id,
        "expires_at": expires_at,
        "revoked": False,
    }
    return raw_token


def verify_remember_me_token(raw_token: str):
    """
    Verify a remember-me token and return the associated user_id if valid.
    """
    if not raw_token:
        return None

    token_hash = _hash_token(raw_token)
    record = REMEMBER_ME_TOKENS.get(token_hash)
    if not record or record.get("revoked"):
        return None

    if record["expires_at"] < _now_utc():
        REMEMBER_ME_TOKENS.pop(token_hash, None)
        return None

    return record["user_id"]


def revoke_remember_me_token(raw_token: str) -> None:
    token_hash = _hash_token(raw_token)
    record = REMEMBER_ME_TOKENS.get(token_hash)
    if record:
        record["revoked"] = True


def set_remember_me_cookie(response, raw_token: str):
    response.set_cookie(
        REMEMBER_ME_COOKIE_NAME,
        raw_token,
        max_age=REMEMBER_ME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,      # set to True in production (HTTPS)
        samesite="Lax",
        path="/",
    )
    return response


def clear_remember_me_cookie(response):
    response.delete_cookie(REMEMBER_ME_COOKIE_NAME, path="/")
    return response


@app.before_request
def load_user_from_remember_me():
    """
    If the user has no active session but has a valid remember-me cookie,
    restore the session for up to 30 days.
    """
    if session.get("user_id"):
        return

    raw_token = request.cookies.get(REMEMBER_ME_COOKIE_NAME)
    user_id = verify_remember_me_token(raw_token)
    if user_id:
        session["user_id"] = user_id
        session.permanent = True
        app.permanent_session_lifetime = timedelta(days=REMEMBER_ME_DAYS)


@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint.
    Expected JSON: {"user_id": "...", "remember_me": true/false}
    Replace the user lookup/password verification with your own auth logic.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    remember_me = bool(data.get("remember_me"))

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    session["user_id"] = user_id
    session.permanent = True
    app.permanent_session_lifetime = timedelta(days=REMEMBER_ME_DAYS)

    response = make_response(jsonify({"message": "Logged in"}))

    if remember_me:
        raw_token = create_remember_me_token(user_id)
        set_remember_me_cookie(response, raw_token)

    return response


@app.route("/logout", methods=["POST"])
def logout():
    """
    Log out the current user and revoke the remember-me token if present.
    """
    raw_token = request.cookies.get(REMEMBER_ME_COOKIE_NAME)
    if raw_token:
        revoke_remember_me_token(raw_token)

    session.pop("user_id", None)

    response = make_response(jsonify({"message": "Logged out"}))
    clear_remember_me_cookie(response)
    return response


@app.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user_id": user_id})


if __name__ == "__main__":
    app.run(debug=True)