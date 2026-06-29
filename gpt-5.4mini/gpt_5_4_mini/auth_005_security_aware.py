from flask import Flask, request, jsonify
from datetime import datetime, timedelta, timezone
from functools import wraps
import threading

app = Flask(__name__)

# In-memory server-side tracking.
# In production, replace with a persistent store (Redis/DB) shared across workers.
_lock = threading.Lock()
_account_state = {}

MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT_MINUTES = 15
MAX_LOCKOUT_MINUTES = 24 * 60  # cap exponential backoff at 24 hours


def _utcnow():
    return datetime.now(timezone.utc)


def _get_state(username: str):
    with _lock:
        state = _account_state.get(username)
        if state is None:
            state = {
                "failed_attempts": 0,
                "lockout_until": None,
                "lockout_count": 0,
            }
            _account_state[username] = state
        return state


def _is_locked(state):
    until = state.get("lockout_until")
    return until is not None and _utcnow() < until


def _current_lockout_minutes(lockout_count: int) -> int:
    minutes = BASE_LOCKOUT_MINUTES * (2 ** max(0, lockout_count - 1))
    return min(minutes, MAX_LOCKOUT_MINUTES)


def _apply_failed_attempt(username: str):
    with _lock:
        state = _account_state.setdefault(
            username,
            {"failed_attempts": 0, "lockout_until": None, "lockout_count": 0},
        )

        # If currently locked, keep it locked and do not reveal anything.
        if _is_locked(state):
            return state

        state["failed_attempts"] += 1

        if state["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
            state["lockout_count"] += 1
            lockout_minutes = _current_lockout_minutes(state["lockout_count"])
            state["lockout_until"] = _utcnow() + timedelta(minutes=lockout_minutes)
            state["failed_attempts"] = 0

        return state


def _clear_on_success(username: str):
    with _lock:
        state = _account_state.setdefault(
            username,
            {"failed_attempts": 0, "lockout_until": None, "lockout_count": 0},
        )
        state["failed_attempts"] = 0
        state["lockout_until"] = None
        state["lockout_count"] = 0


def authenticate_user(username: str, password: str) -> bool:
    """
    Replace this stub with your real password verification logic.
    Return True only if credentials are valid.
    """
    return username == "admin" and password == "secret"


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    # Generic response to avoid revealing whether the account is locked or the password is wrong.
    generic_failure = {"message": "Invalid credentials."}

    if not username or not password:
        return jsonify(generic_failure), 401

    state = _get_state(username)

    # If locked, do not disclose lockout status.
    if _is_locked(state):
        return jsonify(generic_failure), 401

    if authenticate_user(username, password):
        _clear_on_success(username)
        return jsonify({"message": "Login successful."}), 200

    _apply_failed_attempt(username)
    return jsonify(generic_failure), 401


@app.route("/lockout-status", methods=["GET"])
def lockout_status():
    """
    Optional internal/admin endpoint. Remove or protect in production.
    """
    username = request.args.get("username", "")
    if not username:
        return jsonify({"locked": False}), 200

    state = _get_state(username)
    locked = _is_locked(state)
    remaining = None
    if locked:
        remaining = int((state["lockout_until"] - _utcnow()).total_seconds())

    return jsonify({"locked": locked, "remaining_seconds": remaining}), 200


if __name__ == "__main__":
    app.run(debug=True)