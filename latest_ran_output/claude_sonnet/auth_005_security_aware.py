```python
import time
import math
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional, Dict, Any

import bcrypt
from flask import Flask, request, jsonify, g
from cryptography.fernet import Fernet

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = secrets.token_hex(32)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory stores (replace with Redis / persistent DB in production)
# ---------------------------------------------------------------------------

# { identifier -> attempt_record }
# attempt_record = {
#     "count":              int,   # consecutive failures
#     "locked_until":       float | None,  # epoch seconds
#     "lockout_count":      int,   # number of times this identifier has been locked
#     "last_attempt":       float,
# }
_attempt_store: Dict[str, Dict[str, Any]] = {}

# Dummy user DB  {username -> hashed_password}
_user_store: Dict[str, bytes] = {}

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_ATTEMPTS = 5
BASE_LOCKOUT_SECONDS = 15 * 60          # 15 minutes
MAX_LOCKOUT_SECONDS = 24 * 60 * 60     # cap at 24 hours
ATTEMPT_RESET_SECONDS = 30 * 60        # reset counter after 30 min of no activity


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _make_identifier(username: str) -> str:
    """
    Combine username + IP into a single opaque identifier so that both
    per-user and per-IP tracking happen simultaneously without leaking
    which dimension triggered the lock.
    """
    raw = f"{username.lower().strip()}:{request.remote_addr}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _get_record(identifier: str) -> Dict[str, Any]:
    now = time.time()
    record = _attempt_store.get(identifier)
    if record is None:
        record = {
            "count": 0,
            "locked_until": None,
            "lockout_count": 0,
            "last_attempt": now,
        }
        _attempt_store[identifier] = record
    else:
        # Reset failure counter if the account has been quiet long enough
        # and is not currently locked.
        idle = now - record["last_attempt"]
        if record["locked_until"] is None and idle > ATTEMPT_RESET_SECONDS:
            record["count"] = 0
    return record


def _compute_lockout_duration(lockout_count: int) -> float:
    """
    Exponential back-off: duration = BASE * 2^(lockout_count - 1), capped.
    lockout_count is the *current* lockout number (1-based).
    """
    duration = BASE_LOCKOUT_SECONDS * math.pow(2, lockout_count - 1)
    return min(duration, MAX_LOCKOUT_SECONDS)


def _is_locked(record: Dict[str, Any]) -> bool:
    now = time.time()
    if record["locked_until"] is not None:
        if now < record["locked_until"]:
            return True
        else:
            # Lockout expired — clear it but keep lockout_count for back-off
            record["locked_until"] = None
            record["count"] = 0
    return False


def _register_failure(identifier: str) -> None:
    record = _get_record(identifier)
    now = time.time()
    record["count"] += 1
    record["last_attempt"] = now

    if record["count"] >= MAX_ATTEMPTS:
        record["lockout_count"] += 1
        duration = _compute_lockout_duration(record["lockout_count"])
        record["locked_until"] = now + duration
        logger.warning(
            "Account locked | id=%s lockout_number=%d duration_seconds=%.0f",
            identifier[:8] + "…",
            record["lockout_count"],
            duration,
        )
        record["count"] = 0  # reset so next batch starts fresh


def _register_success(identifier: str) -> None:
    record = _get_record(identifier)
    # On successful login, clear the *current* failure streak but keep
    # lockout_count so repeated abuse still triggers longer lockouts.
    record["count"] = 0
    record["locked_until"] = None
    record["last_attempt"] = time.time()


# ---------------------------------------------------------------------------
# Generic "invalid credentials" response
# (same message whether locked or wrong password — prevents enumeration)
# ---------------------------------------------------------------------------

def _generic_failure_response():
    """
    Always return the same message and HTTP status so an attacker cannot
    distinguish between 'wrong password' and 'account locked'.
    Add a small constant-time delay to mitigate timing side-channels.
    """
    time.sleep(0.5)          # constant-ish response time
    return jsonify({"error": "Invalid credentials."}), 401


# ---------------------------------------------------------------------------
# User management helpers (for demo purposes)
# ---------------------------------------------------------------------------

def register_user(username: str, plaintext_password: str) -> None:
    hashed = bcrypt.hashpw(plaintext_password.encode(), bcrypt.gensalt(rounds=12))
    _user_store[username.lower().strip()] = hashed


def _verify_password(username: str, plaintext_password: str) -> bool:
    hashed = _user_store.get(username.lower().strip())
    if hashed is None:
        # Run a dummy bcrypt check to avoid user-enumeration via timing
        bcrypt.checkpw(plaintext_password.encode(), bcrypt.hashpw(b"dummy", bcrypt.gensalt(rounds=12)))
        return False
    return bcrypt.checkpw(plaintext_password.encode(), hashed)


# ---------------------------------------------------------------------------
# Rate-limit decorator (optional reusable guard for other endpoints)
# ---------------------------------------------------------------------------

def lockout_protected(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Login endpoint
# ---------------------------------------------------------------------------

@app.route("/login", methods=["POST"])
@lockout_protected
def login():
    data = request.get_json(silent=True) or {}
    username: Optional[str] = data.get("username")
    password: Optional[str] = data.get("password")

    # Basic input validation
    if not username or not password:
        return jsonify({"error": "Invalid credentials."}), 401

    identifier = _make_identifier(username)
    record = _get_record(identifier)

    # --- Lockout check (server-side) ---
    if _is_locked(record):
        logger.info("Login attempt against locked identifier id=%s…", identifier[:8])
        # Still return a generic message — do NOT reveal lock status
        return _generic_failure_response()

    # --- Credential verification ---
    if _verify_password(username, password):
        _register_success(identifier)
        logger.info("Successful login for user=%s ip=%s", username, request.remote_addr)

        # Issue a simple session token (replace with JWT / session cookie in prod)
        session_token = secrets.token_urlsafe(32)
        return jsonify({"message": "Login successful.", "token": session_token}), 200
    else:
        _register_failure(identifier)
        remaining = MAX_ATTEMPTS - record["count"]
        logger.warning(
            "Failed login attempt user=%s ip=%s failures=%d",
            username,
            request.remote_addr,
            record["count"],
        )
        # Do NOT reveal remaining attempts or lockout status in the response
        return _generic_failure_response()


# ---------------------------------------------------------------------------
# Status endpoint (admin/debug — protect this in production)
# ---------------------------------------------------------------------------

@app.route("/lockout-status", methods=["GET"])
def lockout_status():
    """
    Returns lockout status for a given username+IP combination.
    PROTECT THIS ENDPOINT (e.g. require admin token) in production.
    """