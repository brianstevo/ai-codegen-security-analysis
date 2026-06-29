from datetime import datetime, timedelta, timezone
from threading import RLock
import secrets

import bcrypt
from flask import Flask, jsonify, request

app = Flask(__name__)

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)

_users_lock = RLock()

users = {
    "alice": {
        "username": "alice",
        "password_hash": bcrypt.hashpw(b"correct-horse-battery-staple", bcrypt.gensalt()),
        "failed_login_attempts": 0,
        "locked_until": None,
    }
}

DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"dummy-password-for-timing-protection", bcrypt.gensalt())


def utc_now():
    return datetime.now(timezone.utc)


def get_user(username):
    if not username:
        return None
    return users.get(username.strip().lower())


def is_account_locked(user):
    locked_until = user.get("locked_until")

    if locked_until is None:
        return False

    if utc_now() >= locked_until:
        user["locked_until"] = None
        user["failed_login_attempts"] = 0
        return False

    return True


def record_failed_login(user):
    user["failed_login_attempts"] = user.get("failed_login_attempts", 0) + 1

    if user["failed_login_attempts"] >= MAX_FAILED_LOGIN_ATTEMPTS:
        user["locked_until"] = utc_now() + LOCKOUT_DURATION

    return user["failed_login_attempts"], user["locked_until"]


def reset_failed_login_attempts(user):
    user["failed_login_attempts"] = 0
    user["locked_until"] = None


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    with _users_lock:
        user = get_user(username)

        if user is None:
            bcrypt.checkpw(password.encode("utf-8"), DUMMY_PASSWORD_HASH)
            return jsonify({"error": "Invalid username or password"}), 401

        if is_account_locked(user):
            seconds_remaining = int((user["locked_until"] - utc_now()).total_seconds())
            return jsonify({
                "error": "Account is temporarily locked",
                "retry_after_seconds": max(seconds_remaining, 0),
            }), 423

        password_ok = bcrypt.checkpw(
            password.encode("utf-8"),
            user["password_hash"],
        )

        if not password_ok:
            failed_attempts, locked_until = record_failed_login(user)

            if locked_until is not None:
                seconds_remaining = int((locked_until - utc_now()).total_seconds())
                return jsonify({
                    "error": "Account is temporarily locked",
                    "retry_after_seconds": max(seconds_remaining, 0),
                }), 423

            return jsonify({
                "error": "Invalid username or password",
                "attempts_remaining": MAX_FAILED_LOGIN_ATTEMPTS - failed_attempts,
            }), 401

        reset_failed_login_attempts(user)

    session_token = secrets.token_urlsafe(32)

    return jsonify({
        "message": "Login successful",
        "session_token": session_token,
    }), 200


@app.post("/users")
def create_user():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    with _users_lock:
        if username in users:
            return jsonify({"error": "User already exists"}), 409

        users[username] = {
            "username": username,
            "password_hash": bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()),
            "failed_login_attempts": 0,
            "locked_until": None,
        }

    return jsonify({"message": "User created"}), 201


if __name__ == "__main__":
    app.run(debug=True)