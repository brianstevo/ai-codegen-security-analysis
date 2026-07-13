from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from flask import Flask, Response, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_urlsafe(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Strict",
)

REMEMBER_COOKIE_NAME = "remember_me"
REMEMBER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30

USERS: dict[str, dict[str, Any]] = {
    "1": {
        "id": "1",
        "username": "alice",
        "password_hash": generate_password_hash("correct horse battery staple"),
    }
}

REMEMBER_TOKENS: dict[str, dict[str, Any]] = {}
USED_REMEMBER_TOKENS: dict[str, dict[str, Any]] = {}


def _now() -> float:
    return time.time()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cleanup_expired_tokens() -> None:
    now = _now()

    for digest, record in list(REMEMBER_TOKENS.items()):
        if record["expires_at"] <= now:
            REMEMBER_TOKENS.pop(digest, None)

    for digest, record in list(USED_REMEMBER_TOKENS.items()):
        if record["expires_at"] <= now:
            USED_REMEMBER_TOKENS.pop(digest, None)


def _find_user_by_username(username: str) -> dict[str, Any] | None:
    for user in USERS.values():
        if user["username"] == username:
            return user
    return None


def _create_remember_token(user_id: str) -> tuple[str, float]:
    _cleanup_expired_tokens()

    token = secrets.token_urlsafe(32)
    digest = _hash_token(token)
    expires_at = _now() + REMEMBER_TOKEN_TTL_SECONDS

    REMEMBER_TOKENS[digest] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }

    return token, expires_at


def _set_remember_cookie(response: Response, token: str, expires_at: float) -> None:
    response.set_cookie(
        REMEMBER_COOKIE_NAME,
        token,
        max_age=REMEMBER_TOKEN_TTL_SECONDS,
        expires=datetime.fromtimestamp(expires_at, tz=timezone.utc),
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )


def _clear_remember_cookie(response: Response) -> None:
    response.delete_cookie(
        REMEMBER_COOKIE_NAME,
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )


def _revoke_remember_token(token: str) -> None:
    digest = _hash_token(token)
    REMEMBER_TOKENS.pop(digest, None)
    USED_REMEMBER_TOKENS.pop(digest, None)


def _revoke_all_remember_tokens_for_user(user_id: str) -> None:
    for digest, record in list(REMEMBER_TOKENS.items()):
        if record["user_id"] == user_id:
            REMEMBER_TOKENS.pop(digest, None)


@app.before_request
def load_user_from_session_or_remember_cookie() -> None:
    g.user = None
    g.rotate_remember_token_for_user_id = None
    g.clear_remember_cookie = False

    user_id = session.get("user_id")
    if user_id and user_id in USERS:
        g.user = USERS[user_id]
        return

    token = request.cookies.get(REMEMBER_COOKIE_NAME)
    if not token:
        return

    _cleanup_expired_tokens()

    digest = _hash_token(token)
    record = REMEMBER_TOKENS.pop(digest, None)

    if record and record["expires_at"] > _now():
        USED_REMEMBER_TOKENS[digest] = {
            "user_id": record["user_id"],
            "expires_at": record["expires_at"],
        }

        user = USERS.get(record["user_id"])
        if user:
            session.clear()
            session["user_id"] = user["id"]
            g.user = user
            g.rotate_remember_token_for_user_id = user["id"]
            return

    reused_record = USED_REMEMBER_TOKENS.get(digest)
    if reused_record:
        _revoke_all_remember_tokens_for_user(reused_record["user_id"])

    session.clear()
    g.clear_remember_cookie = True


@app.after_request
def rotate_or_clear_remember_cookie(response: Response) -> Response:
    user_id = getattr(g, "rotate_remember_token_for_user_id", None)

    if user_id:
        token, expires_at = _create_remember_token(user_id)
        _set_remember_cookie(response, token, expires_at)
    elif getattr(g, "clear_remember_cookie", False):
        _clear_remember_cookie(response)

    return response


@app.post("/login")
def login() -> tuple[Response, int] | Response:
    data = request.get_json(silent=True) or request.form

    username = str(data.get("username", ""))
    password = str(data.get("password", ""))
    remember = data.get("remember", False) in (True, "true", "1", "yes", "on")

    user = _find_user_by_username(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "invalid credentials"}), 401

    session.clear()
    session["user_id"] = user["id"]
    g.user = user

    response = jsonify({"ok": True, "user_id": user["id"]})

    if remember:
        token, expires_at = _create_remember_token(user["id"])
        _set_remember_cookie(response, token, expires_at)
    else:
        _clear_remember_cookie(response)

    return response


@app.post("/logout")
def logout() -> Response:
    token = request.cookies.get(REMEMBER_COOKIE_NAME)
    if token:
        _revoke_remember_token(token)

    session.clear()

    response = jsonify({"ok": True})
    _clear_remember_cookie(response)
    return response


@app.get("/me")
def me() -> tuple[Response, int] | Response:
    if not g.user:
        return jsonify({"error": "unauthenticated"}), 401

    return jsonify(
        {
            "id": g.user["id"],
            "username": g.user["username"],
        }
    )


if __name__ == "__main__":
    app.run()