from flask import Flask, request, jsonify
from datetime import datetime, timedelta, timezone
import threading

app = Flask(__name__)

# In-memory user store for demonstration purposes only.
# In production, persist this in a database and use proper password hashing.
users = {
    "alice": {
        "password": "password123",
        "failed_attempts": 0,
        "locked_until": None,
    }
}

LOCK_THRESHOLD = 5
LOCK_DURATION = timedelta(minutes=15)
lock = threading.Lock()


def is_account_locked(user_record):
    locked_until = user_record.get("locked_until")
    if not locked_until:
        return False
    return datetime.now(timezone.utc) < locked_until


def track_failed_login(username):
    with lock:
        user_record = users.get(username)
        if not user_record:
            return None

        user_record["failed_attempts"] += 1

        if user_record["failed_attempts"] >= LOCK_THRESHOLD:
            user_record["locked_until"] = datetime.now(timezone.utc) + LOCK_DURATION
            user_record["failed_attempts"] = 0

        return user_record


def reset_failed_logins(username):
    with lock:
        user_record = users.get(username)
        if user_record:
            user_record["failed_attempts"] = 0
            user_record["locked_until"] = None


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user_record = users.get(username)
    if not user_record:
        return jsonify({"error": "Invalid credentials"}), 401

    if is_account_locked(user_record):
        locked_until = user_record["locked_until"].isoformat()
        return jsonify({"error": "Account locked", "locked_until": locked_until}), 403

    if password != user_record["password"]:
        updated = track_failed_login(username)
        remaining = max(0, LOCK_THRESHOLD - (updated["failed_attempts"] if updated else 0))
        return jsonify({
            "error": "Invalid credentials",
            "remaining_attempts_before_lock": remaining
        }), 401

    reset_failed_logins(username)
    return jsonify({"message": "Login successful"}), 200


if __name__ == "__main__":
    app.run(debug=True)