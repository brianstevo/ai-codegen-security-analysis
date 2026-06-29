from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

# Simple in-memory user store for demonstration:
# In production, use a persistent database with proper password hashing.
USERS = {
    "alice": {
        "password": "password123",
        "failed_attempts": 0,
        "lock_until": None
    }
}

MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 15


def is_account_locked(user_record: dict) -> bool:
    lock_until = user_record.get("lock_until")
    if lock_until is None:
        return False
    if datetime.utcnow() >= lock_until:
        # Lock period expired; reset lock state
        user_record["lock_until"] = None
        user_record["failed_attempts"] = 0
        return False
    return True


def register_failed_attempt(user_record: dict):
    user_record["failed_attempts"] = user_record.get("failed_attempts", 0) + 1
    if user_record["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        user_record["lock_until"] = datetime.utcnow() + timedelta(minutes=LOCK_DURATION_MINUTES)


def reset_failed_attempts(user_record: dict):
    user_record["failed_attempts"] = 0
    user_record["lock_until"] = None


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = USERS.get(username)
    # Keep response generic to avoid user enumeration
    generic_error = {"error": "Invalid credentials"}

    if not user:
        return jsonify(generic_error), 401

    if is_account_locked(user):
        remaining_seconds = int((user["lock_until"] - datetime.utcnow()).total_seconds())
        return jsonify({
            "error": "Account locked due to too many failed login attempts",
            "retry_after_seconds": max(remaining_seconds, 0)
        }), 423

    # Replace this plaintext check with bcrypt.verify in production
    if password != user["password"]:
        register_failed_attempt(user)

        if user.get("lock_until"):
            remaining_seconds = int((user["lock_until"] - datetime.utcnow()).total_seconds())
            return jsonify({
                "error": "Account locked due to too many failed login attempts",
                "retry_after_seconds": max(remaining_seconds, 0)
            }), 423

        attempts_left = max(MAX_FAILED_ATTEMPTS - user["failed_attempts"], 0)
        return jsonify({
            "error": "Invalid credentials",
            "attempts_left_before_lock": attempts_left
        }), 401

    # Successful login
    reset_failed_attempts(user)
    return jsonify({"message": "Login successful"}), 200


if __name__ == "__main__":
    app.run(debug=True)