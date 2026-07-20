from datetime import datetime, timedelta, timezone
from functools import wraps
import hashlib
import secrets
import threading

import bcrypt
from flask import (
    Flask,
    after_this_request,
    g,
    jsonify,
    make_response,
    redirect,
    request,
    session,
    url_for,
)

app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_urlsafe(32),
    REMEMBER_COOKIE_NAME="remember_me",
    REMEMBER_COOKIE_MAX_AGE=60 * 60 * 24 * 30,  # 30 days
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Strict",
)

users = {
    "1": {
        "id": "1",
        "username": "alice",
        "password_hash": bcrypt.hashpw(b"correct-horse-battery-staple", bcrypt.gensalt()),
    }
}

remember_tokens = {}
user_token_index = {}
remember_lock = threading.Lock()


def utcnow():
    return datetime.now(timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_remember_token() -> str:
    return secrets.token_urlsafe(64)


def set_remember_cookie(response, token: str):
    response.set_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        token,
        max_age=app.config["REMEMBER_COOKIE_MAX_AGE"],
        httponly=True,
        secure=True,
        samesite="Strict",
        path="/",
    )


def clear_remember_cookie(response):
    response.delete_cookie(
        app.config["REMEMBER_COOKIE_NAME"],
        path="/",
        secure=True,
        httponly=True,
        samesite="Strict",
    )


def cleanup_expired_remember_tokens():
    now = utcnow()
    expired_hashes = [
        token_hash
        for token_hash, data in remember_tokens.items()
        if data["expires_at"] <= now
    ]

    for token_hash in expired_hashes:
        user_id = remember_tokens[token_hash]["user_id"]
        remember_tokens.pop(token_hash, None)

        indexed = user_token_index.get(user_id)
        if indexed is not None:
            indexed.discard(token_hash)
            if not indexed:
                user_token_index.pop(user_id, None)


def store_remember_token(user_id: str, token: str):
    token_hash = hash_token(token)
    expires_at = utcnow() + timedelta(seconds=app.config["REMEMBER_COOKIE_MAX_AGE"])

    remember_tokens[token_hash] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }
    user_token_index.setdefault(user_id, set()).add(token_hash)


def revoke_remember_token(token: str):
    token_hash = hash_token(token)

    with remember_lock:
        data = remember_tokens.pop(token_hash, None)
        if not data:
            return

        indexed = user_token_index.get(data["user_id"])
        if indexed is not None:
            indexed.discard(token_hash)
            if not indexed:
                user_token_index.pop(data["user_id"], None)


def revoke_all_user_remember_tokens(user_id: str):
    with remember_lock:
        for token_hash in list(user_token_index.get(user_id, set())):
            remember_tokens.pop(token_hash, None)
        user_token_index.pop(user_id, None)


def issue_remember_cookie(user_id: str):
    token = generate_remember_token()

    with remember_lock:
        cleanup_expired_remember_tokens()
        store_remember_token(user_id, token)

    @after_this_request
    def apply_remember_cookie(response):
        set_remember_cookie(response, token)
        return response


def rotate_remember_token(old_token: str, user_id: str):
    new_token = generate_remember_token()
    old_token_hash = hash_token(old_token)

    with remember_lock:
        cleanup_expired_remember_tokens()
        remember_tokens.pop(old_token_hash, None)

        indexed = user_token_index.get(user_id)
        if indexed is not None:
            indexed.discard(old_token_hash)
            if not indexed:
                user_token_index.pop(user_id, None)

        store_remember_token(user_id, new_token)

    @after_this_request
    def apply_rotated_remember_cookie(response):
        set_remember_cookie(response, new_token)
        return response


@app.before_request
def load_user_from_session_or_remember_cookie():
    g.user = None

    user_id = session.get("user_id")
    if user_id and user_id in users:
        g.user = users[user_id]
        return

    token = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    if not token:
        return

    token_hash = hash_token(token)

    with remember_lock:
        cleanup_expired_remember_tokens()
        data = remember_tokens.get(token_hash)

        if not data or data["expires_at"] <= utcnow() or data["user_id"] not in users:
            data = None

    if not data:
        @after_this_request
        def clear_invalid_remember_cookie(response):
            clear_remember_cookie(response)
            return response

        return

    user_id = data["user_id"]
    session.clear()
    session["user_id"] = user_id
    session.permanent = True
    g.user = users[user_id]

    rotate_remember_token(token, user_id)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not g.user:
            return jsonify({"error": "authentication_required"}), 401
        return view(*args, **kwargs)

    return wrapped


@app.post("/login")
def login():
    username = request.form.get("username", "")
    password = request.form.get("password", "").encode("utf-8")
    remember = request.form.get("remember") == "1"

    user = next((u for u in users.values() if u["username"] == username), None)
    if not user or not bcrypt.checkpw(password, user["password_hash"]):
        return jsonify({"error": "invalid_credentials"}), 401

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = True

    response = make_response(jsonify({"ok": True, "user_id": user["id"]}))

    if remember:
        token = generate_remember_token()
        with remember_lock:
            cleanup_expired_remember_tokens()
            store_remember_token(user["id"], token)
        set_remember_cookie(response, token)
    else:
        clear_remember_cookie(response)

    return response


@app.post("/logout")
def logout():
    token = request.cookies.get(app.config["REMEMBER_COOKIE_NAME"])
    if token:
        revoke_remember_token(token)

    session.clear()

    response = make_response(jsonify({"ok": True}))
    clear_remember_cookie(response)
    return response


@app.get("/me")
@login_required
def me():
    return jsonify(
        {
            "id": g.user["id"],
            "username": g.user["username"],
        }
    )


@app.post("/logout-all")
@login_required
def logout_all():
    revoke_all_user_remember_tokens(g.user["id"])
    session.clear()

    response = make_response(jsonify({"ok": True}))
    clear_remember_cookie(response)
    return response


if __name__ == "__main__":
    app.run()