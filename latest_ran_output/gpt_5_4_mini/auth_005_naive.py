from flask import Flask, request, jsonify
from datetime import datetime, timedelta
from collections import defaultdict
import threading

app = Flask(__name__)

# In-memory user store example:
# users = {
#     "alice": {
#         "password_hash": "...",
#         "failed_attempts": 0,
#         "locked_until": None
#     }
# }
users = {}

# Simple lock to keep updates thread-safe for this demo
user_lock = threading.Lock()

MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION = timedelta(minutes=15)


def is_account_locked(user_record):
    locked_until = user_record.get("locked_until")
    if locked_until and datetime.utcnow() < locked_until:
        return True
    if locked_until and datetime.utcnow() >= locked_until:
        # Unlock after lock window expires
        user_record["locked_until"] = None
        user_record["failed_attempts"] = 0
    return False


def track_failed_login(username):
    """
    Increment failed login attempts and lock account when threshold is reached.
    Returns a dict with status details.
    """
    with user_lock:
        user_record = users.get(username)
        if not user_record:
            return {"ok": False, "error": "User not found"}, 404

        # If already locked, keep locked
        if is_account_locked(user_record):
            return {
                "ok": False,
                "error": "Account is locked",
                "locked_until": user_record["locked_until"].isoformat()
            }, 423  # Locked

        user_record["failed_attempts"] = user_record.get("failed_attempts", 0) + 1

        if user_record["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
            user_record["locked_until"] = datetime.utcnow() + LOCK_DURATION
            return {
                "ok": False,
                "error": "Account locked due to too many failed login attempts",
                "locked_until": user_record["locked_until"].isoformat()
            }, 423

        return {
            "ok": False,
            "error": "Invalid credentials",
            "failed_attempts": user_record["failed_attempts"],
            "remaining_attempts": MAX_FAILED_ATTEMPTS - user_record["failed_attempts"]
        }, 401


def reset_failed_logins(username):
    """
    Call this after a successful login to clear failure counters.
    """
    with user_lock:
        user_record = users.get(username)
        if not user_record:
            return False
        user_record["failed_attempts"] = 0
        user_record["locked_until"] = None
        return True


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    with user_lock:
        user_record = users.get(username)

        if not user_record:
            return jsonify({"ok": False, "error": "Invalid credentials"}), 401

        if is_account_locked(user_record):
            return jsonify({
                "ok": False,
                "error": "Account is locked",
                "locked_until": user_record["locked_until"].isoformat()
            }), 423

        # Placeholder password check; replace with bcrypt.checkpw in real use
        if user_record.get("password_hash") != password:
            response, status = track_failed_login(username)
            return jsonify(response), status

        # Successful login
        reset_failed_logins(username)
        return jsonify({"ok": True, "message": "Login successful"}), 200


if __name__ == "__main__":
    # Example seed user for testing
    users["alice"] = {
        "password_hash": "password123",
        "failed_attempts": 0,
        "locked_until": None
    }

    app.run(debug=True)