import time
import threading
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5          # lock after this many consecutive failures
LOCKOUT_DURATION = 15 * 60       # lockout time in seconds (15 minutes)
ATTEMPT_WINDOW = 15 * 60         # window in which failures are counted (15 minutes)

# In-memory store for login attempt tracking.
# In production, use a persistent/shared store (e.g. Redis) instead.
# Structure: { username: {"failures": [timestamps], "locked_until": float|None} }
_login_attempts = {}
_lock = threading.Lock()


def _now():
    return time.time()


def _prune_old_failures(record):
    """Remove failure timestamps outside the rolling window."""
    cutoff = _now() - ATTEMPT_WINDOW
    record["failures"] = [t for t in record["failures"] if t > cutoff]


def is_account_locked(username):
    """Return (locked: bool, seconds_remaining: int)."""
    with _lock:
        record = _login_attempts.get(username)
        if not record:
            return False, 0

        locked_until = record.get("locked_until")
        if locked_until and _now() < locked_until:
            remaining = int(locked_until - _now())
            return True, remaining

        # Lock expired -> clear it.
        if locked_until and _now() >= locked_until:
            record["locked_until"] = None
            record["failures"] = []

        return False, 0


def record_failed_attempt(username):
    """Record a failed login. Lock the account if threshold is exceeded.

    Returns (locked: bool, attempts_remaining: int, seconds_remaining: int).
    """
    with _lock:
        record = _login_attempts.setdefault(
            username, {"failures": [], "locked_until": None}
        )
        _prune_old_failures(record)
        record["failures"].append(_now())

        if len(record["failures"]) >= MAX_FAILED_ATTEMPTS:
            record["locked_until"] = _now() + LOCKOUT_DURATION
            return True, 0, LOCKOUT_DURATION

        attempts_remaining = MAX_FAILED_ATTEMPTS - len(record["failures"])
        return False, attempts_remaining, 0


def reset_failed_attempts(username):
    """Clear all failure tracking for a user (call on successful login)."""
    with _lock:
        _login_attempts.pop(username, None)


def _verify_credentials(username, password):
    """Placeholder credential check. Replace with real DB + bcrypt verification."""
    import bcrypt

    # Example fixed user; in production look up the stored hash from your DB.
    fake_user_hashes = {
        "alice": bcrypt.hashpw(b"correct horse battery", bcrypt.gensalt()),
    }
    stored = fake_user_hashes.get(username)
    if stored is None:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), stored)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    # 1. Check lock status before doing anything else.
    locked, seconds_remaining = is_account_locked(username)
    if locked:
        return jsonify({
            "error": "Account locked due to too many failed login attempts.",
            "retry_after_seconds": seconds_remaining
        }), 429

    # 2. Verify credentials.
    if _verify_credentials(username, password):
        reset_failed_attempts(username)
        return jsonify({"message": "Login successful."}), 200

    # 3. Record failure and possibly lock.
    just_locked, attempts_remaining, lock_seconds = record_failed_attempt(username)
    if just_locked:
        return jsonify({
            "error": "Account locked due to too many failed login attempts.",
            "retry_after_seconds": lock_seconds
        }), 429

    return jsonify({
        "error": "Invalid credentials.",
        "attempts_remaining": attempts_remaining
    }), 401


if __name__ == "__main__":
    app.run(debug=False)