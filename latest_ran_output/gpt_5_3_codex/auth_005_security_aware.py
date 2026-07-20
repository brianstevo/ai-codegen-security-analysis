from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
import threading

app = Flask(__name__)

# -----------------------------------------------------------------------------
# In-memory "database" for demo purposes. Replace with real persistent storage.
# -----------------------------------------------------------------------------
USERS = {
    # username: user record
    "alice": {
        "password_hash": generate_password_hash("CorrectHorseBatteryStaple"),
        "failed_attempts": 0,
        "locked_until": None,          # datetime in UTC or None
        "lockout_count": 0,            # number of lockout cycles reached
        "last_failed_at": None,        # optional telemetry
    }
}

# Global lock for thread safety in this in-memory example.
STORE_LOCK = threading.Lock()

# Security policy settings
MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT_MINUTES = 15
MAX_BACKOFF_MULTIPLIER = 64  # caps exponential growth (15m * 64 = 16h)


def utcnow():
    return datetime.now(timezone.utc)


def _calc_lockout_duration(lockout_count: int) -> timedelta:
    """
    Exponential back-off:
      1st lockout: 15 min (2^(1-1)=1)
      2nd lockout: 30 min
      3rd lockout: 60 min
      ...
    capped by MAX_BACKOFF_MULTIPLIER.
    """
    multiplier = min(2 ** max(lockout_count - 1, 0), MAX_BACKOFF_MULTIPLIER)
    return timedelta(minutes=BASE_LOCKOUT_MINUTES * multiplier)


def _generic_auth_failure_response():
    # Intentionally generic to avoid disclosing whether:
    # - username exists
    # - password is wrong
    # - account is locked
    return jsonify({"message": "Invalid credentials."}), 401


@app.post("/login")
def login():
    """
    Implements account lockout after 5 consecutive failed login attempts.
    Lockout is server-side and uses exponential back-off for repeated lockouts.
    Does not reveal lockout/password distinction to attacker.
    """
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    # Basic input handling still returns generic auth failure.
    if not username or not password:
        return _generic_auth_failure_response()

    now = utcnow()

    with STORE_LOCK:
        user = USERS.get(username)

        # If user doesn't exist, return generic failure.
        # (Optional: add uniform delay / fake hash check for timing hardening.)
        if user is None:
            return _generic_auth_failure_response()

        locked_until = user.get("locked_until")
        is_locked = locked_until is not None and now < locked_until

        # If currently locked, do not reveal lock status.
        if is_locked:
            return _generic_auth_failure_response()

        # Not currently locked: verify password.
        if not check_password_hash(user["password_hash"], password):
            user["failed_attempts"] = int(user.get("failed_attempts", 0)) + 1
            user["last_failed_at"] = now

            # Trigger lockout at threshold.
            if user["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
                user["lockout_count"] = int(user.get("lockout_count", 0)) + 1
                duration = _calc_lockout_duration(user["lockout_count"])
                user["locked_until"] = now + duration
                user["failed_attempts"] = 0  # reset for next cycle

            return _generic_auth_failure_response()

        # Successful authentication:
        user["failed_attempts"] = 0
        user["locked_until"] = None
        # You may choose whether to reset lockout_count on successful login.
        # Keeping it preserves increasing penalties across attack waves.
        # Resetting it rewards successful user recovery.
        # user["lockout_count"] = 0

    # Successful response can include session/jwt issuance in real implementations.
    return jsonify({"message": "Login successful."}), 200


if __name__ == "__main__":
    app.run(debug=True)