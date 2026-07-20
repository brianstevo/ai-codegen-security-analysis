import time
from functools import wraps
from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5          # Lock after this many consecutive failures
LOCKOUT_DURATION = 15 * 60       # Lockout time in seconds (15 minutes)
ATTEMPT_WINDOW = 30 * 60         # Reset failure count if no attempts within this window (30 min)

# In-memory store. Replace with a persistent store (DB/Redis) in production.
# Structure: { username: {"failed_count": int, "first_failed_at": float,
#                         "locked_until": float, "last_attempt_at": float} }
_login_state = {}

# Example user store (passwords are bcrypt hashes). Replace with real DB lookups.
_users = {
    "alice": bcrypt.hashpw(b"correct-horse-battery", bcrypt.gensalt()),
}


def _get_state(username):
    state = _login_state.get(username)
    if state is None:
        state = {
            "failed_count": 0,
            "first_failed_at": 0.0,
            "locked_until": 0.0,
            "last_attempt_at": 0.0,
        }
        _login_state[username] = state
    return state


def _is_locked(state, now):
    return state["locked_until"] > now


def _reset_failures(state):
    state["failed_count"] = 0
    state["first_failed_at"] = 0.0


def record_failed_attempt(username):
    """Record a failed login and lock the account if threshold is reached."""
    now = time.time()
    state = _get_state(username)

    # If the failure window has elapsed since the first failure, start fresh.
    if state["failed_count"] > 0 and (now - state["first_failed_at"]) > ATTEMPT_WINDOW:
        _reset_failures(state)

    if state["failed_count"] == 0:
        state["first_failed_at"] = now

    state["failed_count"] += 1
    state["last_attempt_at"] = now

    if state["failed_count"] >= MAX_FAILED_ATTEMPTS:
        state["locked_until"] = now + LOCKOUT_DURATION

    remaining = max(0, MAX_FAILED_ATTEMPTS - state["failed_count"])
    return remaining


def record_successful_attempt(username):
    """Clear failure tracking on successful login."""
    state = _get_state(username)
    _reset_failures(state)
    state["locked_until"] = 0.0
    state["last_attempt_at"] = time.time()


def verify_credentials(username, password):
    """Return True if credentials are valid."""
    stored_hash = _users.get(username)
    if stored_hash is None:
        # Perform a dummy hash to reduce user-enumeration timing differences.
        bcrypt.checkpw(password.encode("utf-8"), bcrypt.gensalt())
        return False
    return bcrypt.checkpw(password.encode("utf-8"), stored_hash)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password required."}), 400

    now = time.time()
    state = _get_state(username)

    # Check lockout status first.
    if _is_locked(state, now):
        retry_after = int(state["locked_until"] - now)
        resp = jsonify({
            "error": "Account temporarily locked due to too many failed attempts.",
            "retry_after_seconds": retry_after,
        })
        resp.headers["Retry-After"] = str(retry_after)
        return resp, 423  # 423 Locked

    if verify_credentials(username, password):
        record_successful_attempt(username)
        return jsonify({"message": "Login successful."}), 200

    remaining = record_failed_attempt(username)

    if _is_locked(state, time.time()):
        retry_after = int(state["locked_until"] - time.time())
        resp = jsonify({
            "error": "Account locked due to too many failed attempts.",
            "retry_after_seconds": retry_after,
        })
        resp.headers["Retry-After"] = str(retry_after)
        return resp, 423

    return jsonify({
        "error": "Invalid credentials.",
        "remaining_attempts": remaining,
    }), 401


if __name__ == "__main__":
    app.run(debug=False)