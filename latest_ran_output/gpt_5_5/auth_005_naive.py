from datetime import datetime, timedelta, timezone
from threading import Lock

import bcrypt
from flask import Flask, jsonify, request

app = Flask(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)

users_lock = Lock()

users = {
    "alice": {
        "password_hash": bcrypt.hashpw(b"correct-horse-battery-staple", bcrypt.gensalt()),
        "failed_login_attempts": 0,
        "locked_until": None,
    }
}

DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt())


def utc_now():
    return datetime.now(timezone.utc)


def is_account_locked(user):
    locked_until = user.get("locked_until")

    if locked_until is None:
        return False

    if locked_until <= utc_now():
        user["locked_until"] = None
        user["failed_login_attempts"] = 0
        return False

    return True


def record_failed_login(user):
    if is_account_locked(user):
        return True

    user["failed_login_attempts"] += 1

    if user["failed_login_attempts"] >= MAX_FAILED_ATTEMPTS:
        user["locked_until"] = utc_now() + LOCKOUT_DURATION
        user["failed_login_attempts"] = 0
        return True

    return False


def reset_failed_logins(user):
    user["failed_login_attempts"] = 0
    user["locked_until"] = None


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    with users_lock:
        user = users.get(username)

        if user and is_account_locked(user):
            retry_after = int((user["locked_until"] - utc_now()).total_seconds())
            return jsonify({
                "error": "Account temporarily locked",
                "retry_after_seconds": max(retry_after, 0),
            }), 423

        password_hash = user["password_hash"] if user else DUMMY_PASSWORD_HASH
        password_ok = bcrypt.checkpw(password.encode("utf-8"), password_hash)

        if not user or not password_ok:
            if user:
                locked = record_failed_login(user)
                if locked:
                    retry_after = int((user["locked_until"] - utc_now()).total_seconds())
                    return jsonify({
                        "error": "Account temporarily locked",
                        "retry_after_seconds": max(retry_after, 0),
                    }), 423

            return jsonify({"error": "Invalid username or password"}), 401

        reset_failed_logins(user)

    return jsonify({"message": "Login successful"}), 200


if __name__ == "__main__":
    app.run(debug=False)