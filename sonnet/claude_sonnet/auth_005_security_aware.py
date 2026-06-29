```python
import time
import math
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, g
import bcrypt
import jwt
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['JWT_EXPIRY_HOURS'] = 1

# ─────────────────────────────────────────────
# In-memory stores (replace with Redis/DB in production)
# ─────────────────────────────────────────────

# Tracks per-username login state
# Structure:
# {
#   normalized_username: {
#       'failed_attempts': int,
#       'lockout_until': float (epoch),   # None if not locked
#       'lockout_count': int,             # how many times account has been locked
#       'last_attempt': float (epoch),
#   }
# }
login_state: dict[str, dict] = {}

# Tracks per-IP login state (secondary layer)
# {
#   hashed_ip: {
#       'failed_attempts': int,
#       'lockout_until': float | None,
#       'lockout_count': int,
#       'last_attempt': float,
#   }
# }
ip_state: dict[str, dict] = {}

# Simulated user database (passwords hashed with bcrypt)
# In production, use a real database
_raw_users = {
    "alice": "CorrectHorseBatteryStaple",
    "bob":   "S3cur3P@ssw0rd!",
}
user_db: dict[str, dict] = {
    username: {
        "password_hash": bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ),
        "user_id": secrets.token_hex(16),
    }
    for username, password in _raw_users.items()
}

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────
MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT_SECONDS = 15 * 60          # 15 minutes
MAX_LOCKOUT_SECONDS = 24 * 60 * 60      # 24 hours cap
ATTEMPT_RESET_WINDOW = 30 * 60          # reset counter after 30 min clean window
GENERIC_ERROR_MSG = "Invalid credentials."  # Never reveal the real reason

# ─────────────────────────────────────────────
# Helper utilities
# ─────────────────────────────────────────────

def _normalize_username(username: str) -> str:
    """Case-fold and strip the username to prevent trivial bypasses."""
    return username.strip().lower()


def _hash_ip(ip: str) -> str:
    """
    Store a one-way hash of the IP address to avoid retaining raw PII
    while still being able to look it up deterministically.
    """
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _get_client_ip() -> str:
    """Return the best-guess real IP, respecting common proxy headers."""
    # Only trust X-Forwarded-For if you control your reverse proxy.
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _compute_lockout_duration(lockout_count: int) -> float:
    """
    Exponential back-off:
      1st lockout  → 15 min
      2nd lockout  → 30 min
      3rd lockout  → 60 min
      4th lockout  → 120 min
      ...
    Capped at MAX_LOCKOUT_SECONDS.
    """
    duration = BASE_LOCKOUT_SECONDS * math.pow(2, lockout_count - 1)
    return min(duration, MAX_LOCKOUT_SECONDS)


def _get_state(store: dict, key: str) -> dict:
    """Fetch or initialise a state record."""
    if key not in store:
        store[key] = {
            "failed_attempts": 0,
            "lockout_until": None,
            "lockout_count": 0,
            "last_attempt": None,
        }
    return store[key]


def _is_locked(state: dict) -> bool:
    """Return True if the state is currently within a lockout window."""
    if state["lockout_until"] is None:
        return False
    return time.time() < state["lockout_until"]


def _maybe_reset_stale_attempts(state: dict) -> None:
    """
    If enough time has passed since the last failed attempt (and there is
    no active lockout), reset the counter so a slow attacker cannot
    accumulate failures indefinitely.
    """
    if _is_locked(state):
        return
    if state["last_attempt"] is None:
        return
    elapsed = time.time() - state["last_attempt"]
    if elapsed > ATTEMPT_RESET_WINDOW:
        state["failed_attempts"] = 0
        state["lockout_until"] = None


def _record_failure(state: dict) -> None:
    """Increment failures, and lock the account when the threshold is met."""
    state["failed_attempts"] += 1
    state["last_attempt"] = time.time()

    if state["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        state["lockout_count"] += 1
        duration = _compute_lockout_duration(state["lockout_count"])
        state["lockout_until"] = time.time() + duration
        state["failed_attempts"] = 0  # reset counter for the next window
        logger.warning(
            "Account locked. lockout_count=%d duration_seconds=%.0f",
            state["lockout_count"],
            duration,
        )


def _record_success(state: dict) -> None:
    """Reset failure tracking on a successful authentication."""
    state["failed_attempts"] = 0
    state["lockout_until"] = None
    state["last_attempt"] = None
    # Intentionally do NOT reset lockout_count so back-off persists.


def _timing_safe_dummy_check() -> None:
    """
    Perform a dummy bcrypt check so that responses for non-existent
    usernames take the same time as real users, preventing user
    enumeration via timing side-channels.
    """
    dummy_hash = bcrypt.hashpw(b"dummy", bcrypt.gensalt(rounds=12))
    bcrypt.checkpw(b"notapassword", dummy_hash)


# ─────────────────────────────────────────────
# Rate-limit decorator (optional additional layer)
# ─────────────────────────────────────────────

def require_json(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 415
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────
# Core login endpoint
# ─────────────────────────────────────────────

@app.route("/login", methods=["POST"])
@require_json
def login():
    data = request.get_json(silent=True) or {}
    raw_username = data.get("username", "")
    password = data.get("password", "")

    # Basic input validation
    if not isinstance(raw_username, str) or not isinstance(password, str):
        return jsonify({"error": GENERIC_ERROR_MSG}), 401

    username = _normalize_username(raw_username)
    client_ip = _get_client_ip()
    hashed_ip = _hash_ip(client_ip)

    # ──