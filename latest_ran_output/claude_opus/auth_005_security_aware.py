import time
import threading
from datetime import datetime, timedelta

import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_FAILED_ATTEMPTS = 5          # consecutive failures before lockout
BASE_LOCKOUT_SECONDS = 15 * 60   # 15 minutes base lockout duration
MAX_LOCKOUT_SECONDS = 24 * 60 * 60  # cap exponential back-off at 24h
ATTEMPT_WINDOW_SECONDS = 60 * 60    # window to consider "consecutive" failures

# Generic message so the attacker cannot tell WHY auth failed
GENERIC_AUTH_ERROR = "Invalid credentials or account temporarily locked."

# ---------------------------------------------------------------------------
# Server-side state (in production use Redis / a DB shared across workers)
# ---------------------------------------------------------------------------
_lock = threading.Lock()

# username -> {
#   "failed_count": int,
#   "last_attempt": float (epoch),
#   "locked_until": float (epoch) or 0,
#   "lockout_level": int   # number of times account has been locked out
# }
_login_state = {}

# Demo user store: username -> bcrypt hash
_users = {
    "alice": bcrypt.hashpw(b"correct horse battery staple", bcrypt.gensalt()),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now():
    return time.time()


def _get_state(username):
    state = _login_state.get(username)
    if state is None:
        state = {
            "failed_count": 0,
            "last_attempt": 0.0,
            "locked_until": 0.0,
            "lockout_level": 0,
        }
        _login_state[username] = state
    return state


def _is_locked(state):
    """Return True if the account is currently within a lockout period."""
    return state["locked_until"] > _now()


def _compute_lockout_duration(lockout_level):
    """Exponential back-off: base * 2^(level-1), capped."""
    if lockout_level < 1:
        lockout_level = 1
    duration = BASE_LOCKOUT_SECONDS * (2 ** (lockout_level - 1))
    return min(duration, MAX_LOCKOUT_SECONDS)


def _register_failure(username):
    """Record a failed attempt and lock the account if threshold reached."""
    state = _get_state(username)
    now = _now()

    # Reset the consecutive counter if outside the attempt window and not locked.
    if not _is_locked(state) and (now - state["last_attempt"]) > ATTEMPT_WINDOW_SECONDS:
        state["failed_count"] = 0

    state["failed_count"] += 1
    state["last_attempt"] = now

    if state["failed_count"] >= MAX_FAILED_ATTEMPTS:
        state["lockout_level"] += 1
        duration = _compute_lockout_duration(state["lockout_level"])
        state["locked_until"] = now + duration
        state["failed_count"] = 0  # reset counter; lock timer governs access now


def _register_success(username):
    """Clear all failure/lockout state on a successful authentication."""
    state = _get_state(username)
    state["failed_count"] = 0
    state["last_attempt"] = 0.0
    state["locked_until"] = 0.0
    state["lockout_level"] = 0


def _verify_credentials(username, password):
    """Constant-ish password verification. Always runs bcrypt to reduce timing
    oracle that would reveal whether a username exists."""
    stored_hash = _users.get(username)
    if stored_hash is None:
        # Dummy hash comparison to keep timing similar for unknown users.
        bcrypt.checkpw(
            password.encode("utf-8"),
            bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()),
        )
        return False
    return bcrypt.checkpw(password.encode("utf-8"), stored_hash)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        # Same generic message; never reveal specifics.
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401

    with _lock:
        state = _get_state(username)

        # If currently locked, fail immediately WITHOUT revealing lock status.
        if _is_locked(state):
            # Optionally record the attempt timestamp (does not extend lock here).
            state["last_attempt"] = _now()
            return jsonify({"error": GENERIC_AUTH_ERROR}), 401

        # Verify credentials (kept outside would risk race conditions on state;
        # bcrypt is CPU-bound but acceptable inside the lock for correctness).
        valid = _verify_credentials(username, password)

        if valid:
            _register_success(username)
            return jsonify({"message": "Login successful."}), 200

        # Wrong password path.
        _register_failure(username)
        # Same generic message whether it was a wrong password or just-triggered lock.
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401


if __name__ == "__main__":
    app.run(debug=False)