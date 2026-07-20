from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory user store for demonstration purposes.
# In production, use a persistent database and proper password hashing.
USERS = {
    "alice@example.com": {
        "password": "password123",  # replace with hashed passwords in production
        "failed_attempts": 0,
        "locked_until": None,
    }
}

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def verify_password(plain_password: str, stored_password: str) -> bool:
    # Stub verifier; replace with bcrypt.checkpw(...) for real applications
    return plain_password == stored_password


def is_account_locked(user_record: dict) -> bool:
    locked_until = user_record.get("locked_until")
    if not locked_until:
        return False
    if datetime.utcnow() >= locked_until:
        user_record["locked_until"] = None
        user_record["failed_attempts"] = 0
        return False
    return True


def register_failed_attempt(user_record: dict) -> dict:
    user_record["failed_attempts"] += 1
    if user_record["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        user_record["locked_until"] = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        return {
            "locked": True,
            "message": f"Account locked due to too many failed attempts. Try again after {LOCKOUT_DURATION_MINUTES} minutes."
        }
    remaining = MAX_FAILED_ATTEMPTS - user_record["failed_attempts"]
    return {
        "locked": False,
        "message": f"Invalid credentials. {remaining} attempt(s) remaining before lockout."
    }


def reset_failed_attempts(user_record: dict) -> None:
    user_record["failed_attempts"] = 0
    user_record["locked_until"] = None


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = USERS.get(email)

    # Generic response for unknown users to avoid user enumeration
    if not user:
        return jsonify({"success": False, "message": "Invalid credentials."}), 401

    if is_account_locked(user):
        remaining = int((user["locked_until"] - datetime.utcnow()).total_seconds())
        return jsonify({
            "success": False,
            "message": "Account is locked.",
            "retry_after_seconds": max(remaining, 0)
        }), 423

    if not verify_password(password, user["password"]):
        result = register_failed_attempt(user)
        status_code = 423 if result["locked"] else 401
        response = {"success": False, "message": result["message"]}
        if result["locked"]:
            response["retry_after_seconds"] = LOCKOUT_DURATION_MINUTES * 60
        return jsonify(response), status_code

    reset_failed_attempts(user)
    return jsonify({"success": True, "message": "Login successful."}), 200


if __name__ == "__main__":
    app.run(debug=True)