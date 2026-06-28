import time
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, g
import bcrypt

app = Flask(__name__)

# ---- In‑memory user store (replace with real DB in production) ----
# Example user: username 'alice', password 'secret'
users = {
    "alice": {
        "password_hash": bcrypt.hashpw(b"secret", bcrypt.gensalt()),
        "failed_attempts": 0,
        "lockout_until": None,   # datetime or None
        "lockout_count": 0       # number of times locked out (for back‑off)
    }
}

# ---- Configuration -------------------------------------------------
MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT = timedelta(minutes=15)   # first lockout duration


def get_user(username: str):
    """Return user dict; if not found, return a dummy record to hide existence."""
    user = users.get(username)
    if user is None:
        # Dummy hash for timing consistency (hash of empty string)
        dummy_hash = bcrypt.hashpw(b"", bcrypt.gensalt())
        return {
            "password_hash": dummy_hash,
            "failed_attempts": 0,
            "lockout_until": None,
            "lockout_count": 0,
            "is_dummy": True
        }
    user["is_dummy"] = False
    return user


def lockout_check(user):
    """Return True if account is currently locked."""
    lu = user.get("lockout_until")
    if lu and datetime.utcnow() < lu:
        return True
    return False


def record_failed_attempt(user):
    """Update counters after a failed login attempt."""
    # If already locked, just keep the lockout (do not extend it here)
    if lockout_check(user):
        return

    user["failed_attempts"] += 1
    if user["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        # Compute exponential back‑off duration
        multiplier = 2 ** user["lockout_count"]
        lock_duration = BASE_LOCKOUT * multiplier
        user["lockout_until"] = datetime.utcnow() + lock_duration
        user["lockout_count"] += 1
        user["failed_attempts"] = 0


def reset_successful_login(user):
    """Clear failure counters after a successful login."""
    user["failed_attempts"] = 0
    user["lockout_until"] = None
    user["lockout_count"] = 0


def generic_error():
    """Return the same response for any authentication failure."""
    return jsonify({"error": "Invalid username or password."}), 401


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = get_user(username)

    # Check lockout first (do not reveal reason)
    if lockout_check(user):
        record_failed_attempt(user)   # still count attempts for back‑off
        return generic_error()

    # Verify password
    password_bytes = password.encode("utf-8")
    if bcrypt.checkpw(password_bytes, user["password_hash"]):
        # Successful login – reset counters (unless dummy)
        if not user.get("is_dummy"):
            reset_successful_login(user)
        # Issue token / session here (omitted for brevity)
        return jsonify({"message": "Login successful."})
    else:
        record_failed_attempt(user)
        return generic_error()


# ---- Optional: protect routes with a simple auth decorator ------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder – implement token/session validation as needed
        return f(*args, **kwargs)
    return decorated


@app.route("/protected")
@login_required
def protected():
    return jsonify({"data": "This is protected content."})


if __name__ == "__main__":
    app.run(debug=True)