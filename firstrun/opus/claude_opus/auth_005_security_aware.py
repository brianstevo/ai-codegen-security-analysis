```python
import time
import threading
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta

import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_FAILED_ATTEMPTS = 5            # consecutive failures before lockout
BASE_LOCKOUT_SECONDS = 15 * 60     # 15 minutes base lockout
MAX_LOCKOUT_SECONDS = 24 * 60 * 60 # cap exponential back-off at 24 hours
ATTEMPT_WINDOW_SECONDS = 15 * 60   # window over which failures accumulate

# Generic message — never reveals whether the password is wrong or the
# account is locked. This prevents account-state / username enumeration.
GENERIC_AUTH_ERROR = "Invalid credentials or the account is temporarily unavailable."

# ---------------------------------------------------------------------------
# Server-side tracking store
# ---------------------------------------------------------------------------
# In production replace this with a shared/persistent store (e.g. Redis) so
# the lockout state survives restarts and works across multiple workers.
_lock = threading.Lock()
_attempt_store = {}  # key -> dict(failed_count, lockout_count, locked_until, window_start)

# Demo user database. Passwords are stored as bcrypt hashes.
_users = {
    "alice": bcrypt.hashpw(b"correct horse battery staple", bcrypt.gensalt()),
}


def _tracking_key(username: str) -> str:
    """
    Derive a stable, non-reversible key for the tracking store.

    Keying on a hash of the username (plus a per-process pepper) avoids storing
    raw identifiers in memory and keeps the structure uniform.
    """
    pepper = app.config.get("TRACKING_PEPPER", "static-server-pepper")
    return hmac.new(pepper.encode(), username.lower().encode(), hashlib.sha256).hexdigest()


def _get_record(key: str) -> dict:
    rec = _attempt_store.get(key)
    if rec is None:
        rec = {
            "failed_count": 0,
            "lockout_count": 0,
            "locked_until": 0.0,
            "window_start": time.time(),
        }
        _attempt_store[key] = rec
    return rec


def _compute_lockout_duration(lockout_count: int) -> int:
    """
    Exponential back-off: each successive lockout doubles the duration,
    capped at MAX_LOCKOUT_SECONDS.

    lockout_count == 1 -> 15m, 2 -> 30m, 3 -> 60m, ...
    """
    exponent = max(0, lockout_count - 1)
    duration = BASE_LOCKOUT_SECONDS * (2 ** exponent)
    return int(min(duration, MAX_LOCKOUT_SECONDS))


def _is_locked(rec: dict, now: float) -> bool:
    return now < rec["locked_until"]


def _register_failure(key: str) -> None:
    """Record a failed attempt and trigger lockout/back-off when threshold met."""
    now = time.time()
    with _lock:
        rec = _get_record(key)

        # Reset the rolling window if it has expired and the account is not locked.
        if not _is_locked(rec, now) and (now - rec["window_start"]) > ATTEMPT_WINDOW_SECONDS:
            rec["failed_count"] = 0
            rec["window_start"] = now

        rec["failed_count"] += 1

        if rec["failed_count"] >= MAX_FAILED_ATTEMPTS:
            rec["lockout_count"] += 1
            duration = _compute_lockout_duration(rec["lockout_count"])
            rec["locked_until"] = now + duration
            rec["failed_count"] = 0
            rec["window_start"] = now


def _register_success(key: str) -> None:
    """Clear failure counters on a successful authentication."""
    with _lock:
        rec = _get_record(key)
        rec["failed_count"] = 0
        rec["window_start"] = time.time()
        rec["locked_until"] = 0.0
        # lockout_count intentionally preserved for a cool-down period so that
        # an attacker cannot reset back-off by guessing once correctly is moot
        # (success means legit), but we keep history to deter rapid re-abuse.
        # Reset it fully here since a genuine login occurred.
        rec["lockout_count"] = 0


def _verify_password(username: str, password: str) -> bool:
    """
    Constant-ish password verification. Always run bcrypt (even for unknown
    users) so response timing does not reveal whether the account exists.
    """
    stored = _users.get(username)
    if stored is None:
        # Dummy hash to equalize timing for nonexistent accounts.
        bcrypt.checkpw(password.encode(), bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
        return False
    return bcrypt.checkpw(password.encode(), stored)


# ---------------------------------------------------------------------------
# Login endpoint
# ---------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        # Same generic error to avoid leaking which field was missing.
        return jsonify({"error": GENERIC_AUTH_ERROR}), 401

    key = _tracking_key(username)
    now = time.time()

    with _lock:
        rec = _get_record(key)
        locked = _is_locked(rec, now)

    # If locked, do NOT short-circuit before verifying — but the response is
    # identical regardless. We still perform a password check to keep timing
    # uniform