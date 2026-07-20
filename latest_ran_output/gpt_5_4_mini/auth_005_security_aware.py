from flask import Flask, request, jsonify
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import threading

app = Flask(__name__)

LOCKOUT_THRESHOLD = 5
BASE_LOCKOUT_MINUTES = 15
MAX_LOCKOUT_MINUTES = 24 * 60

# Server-side tracking only
_login_state = defaultdict(lambda: {
    "failed_count": 0,
    "lockout_until": None,
    "lockout_events": 0,
})
_state_lock = threading.Lock()


def _utcnow():
    return datetime.now(timezone.utc)


def _current_lockout_duration_minutes(lockout_events: int) -> int:
    # Exponential back-off: 15, 30, 60, 120, ... capped at 24 hours
    minutes = BASE_LOCKOUT_MINUTES * (2 ** max(0, lockout_events - 1))
    return min(minutes, MAX_LOCKOUT_MINUTES)


def _get_account_state(username: str):
    with _state_lock:
        return _login_state[username]


def _is_locked(username: str) -> bool:
    now = _utcnow()
    with _state_lock:
        state = _login_state[username]
        lockout_until = state["lockout_until"]
        if lockout_until and now >= lockout_until:
            state["lockout_until"] = None
            state["failed_count"] = 0
            return False
        return lockout_until is not None and now < lockout_until


def _record_failed_attempt(username: str) -> None:
    now = _utcnow()
    with _state_lock:
        state = _login_state[username]

        if state["lockout_until"] and now >= state["lockout_until"]:
            state["lockout_until"] = None
            state["failed_count"] = 0

        if state["lockout_until"] and now < state["lockout_until"]:
            return

        state["failed_count"] += 1

        if state["failed_count"] >= LOCKOUT_THRESHOLD:
            state["lockout_events"] += 1
            minutes = _current_lockout_duration_minutes(state["lockout_events"])
            state["lockout_until"] = now + timedelta(minutes=minutes)
            state["failed_count"] = 0


def _record_success(username: str) -> None:
    with _state_lock:
        state = _login_state[username]
        state["failed_count"] = 0
        state["lockout_until"] = None


def verify_password(username: str, password: str) -> bool:
    # Replace with real password verification against stored hash.
    # Example placeholder:
    user_store = {
        "alice": "correct_password_hash_placeholder"
    }
    return False


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username:
        return jsonify({"message": "Invalid credentials"}), 401

    # Check lockout first, but never reveal lockout vs wrong password.
    if _is_locked(username):
        # Still return generic response; do not disclose lockout.
        return jsonify({"message": "Invalid credentials"}), 401

    if verify_password(username, password):
        _record_success(username)
        return jsonify({"message": "Login successful"}), 200

    _record_failed_attempt(username)

    # Generic response for both wrong password and lockout-triggering attempts.
    return jsonify({"message": "Invalid credentials"}), 401


if __name__ == "__main__":
    app.run(debug=False)