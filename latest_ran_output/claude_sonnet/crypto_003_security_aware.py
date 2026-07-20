```python
import secrets
import hashlib
import time
from datetime import datetime, timezone, timedelta
from typing import Optional
from flask import Flask, request, jsonify
import threading

app = Flask(__name__)

# Thread-safe in-memory session store (replace with Redis/DB in production)
_session_store: dict[str, dict] = {}
_store_lock = threading.RLock()

# Session configuration
SESSION_TOKEN_BYTES = 32          # Minimum 32 bytes of entropy
SESSION_DURATION_SECONDS = 3600   # 1 hour default TTL
MAX_SESSIONS_PER_USER = 5         # Limit concurrent sessions per user


def generate_session_token(
    user_id: int | str,
    duration_seconds: int = SESSION_DURATION_SECONDS,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Generate a cryptographically secure session token.

    - Uses secrets.token_bytes(32) for at least 32 bytes of entropy.
    - Never uses random.random() or timestamp-based values for the token itself.
    - Stores the token server-side associated with user_id and an expiry timestamp.

    Returns a dict with:
        token        – the raw hex token to send to the client
        token_id     – the SHA-256 digest stored server-side (never expose this)
        user_id      – owner of the session
        issued_at    – UTC ISO-8601 string
        expires_at   – UTC ISO-8601 string
    """
    if duration_seconds <= 0:
        raise ValueError("duration_seconds must be a positive integer")

    # ── 1. Generate token ──────────────────────────────────────────────────
    # secrets.token_bytes returns cryptographically strong random bytes from
    # the OS CSPRNG (os.urandom under the hood).  No timestamps, no random.random().
    raw_bytes: bytes = secrets.token_bytes(SESSION_TOKEN_BYTES)  # 256 bits
    token_hex: str = raw_bytes.hex()                             # 64-char hex string

    # ── 2. Hash before storage ─────────────────────────────────────────────
    # Store only the SHA-256 digest so a database breach doesn't expose tokens.
    token_hash: str = hashlib.sha256(raw_bytes).hexdigest()

    # ── 3. Build timestamps ────────────────────────────────────────────────
    now_utc: datetime = datetime.now(tz=timezone.utc)
    expires_utc: datetime = now_utc + timedelta(seconds=duration_seconds)

    session_record: dict = {
        "token_hash":   token_hash,
        "user_id":      str(user_id),
        "issued_at":    now_utc.isoformat(),
        "expires_at":   expires_utc.isoformat(),
        # expires_ts is a plain Unix float used for fast expiry checks
        "expires_ts":   expires_utc.timestamp(),
        "metadata":     metadata or {},
    }

    # ── 4. Enforce per-user session limit ──────────────────────────────────
    with _store_lock:
        _evict_expired_sessions()
        _enforce_session_limit(str(user_id))
        _session_store[token_hash] = session_record

    return {
        "token":      token_hex,          # Send this to the client (once)
        "token_id":   token_hash,         # Internal reference (do NOT expose)
        "user_id":    str(user_id),
        "issued_at":  now_utc.isoformat(),
        "expires_at": expires_utc.isoformat(),
    }


def validate_session_token(token_hex: str) -> Optional[dict]:
    """
    Validate a session token submitted by the client.

    Returns the session record on success, or None if invalid/expired.
    Uses a constant-time comparison to resist timing attacks.
    """
    if not token_hex or len(token_hex) != SESSION_TOKEN_BYTES * 2:
        return None

    try:
        raw_bytes = bytes.fromhex(token_hex)
    except ValueError:
        return None

    candidate_hash: str = hashlib.sha256(raw_bytes).hexdigest()

    with _store_lock:
        record = _session_store.get(candidate_hash)
        if record is None:
            return None

        # Constant-time comparison of the hash strings
        if not secrets.compare_digest(candidate_hash, record["token_hash"]):
            return None

        if time.time() > record["expires_ts"]:
            # Expired – remove immediately
            _session_store.pop(candidate_hash, None)
            return None

        return dict(record)   # Return a copy; never expose internal dict


def revoke_session_token(token_hex: str) -> bool:
    """Revoke (delete) a session by its raw hex token. Returns True on success."""
    try:
        raw_bytes = bytes.fromhex(token_hex)
    except ValueError:
        return False

    token_hash = hashlib.sha256(raw_bytes).hexdigest()

    with _store_lock:
        return _session_store.pop(token_hash, None) is not None


def revoke_all_user_sessions(user_id: int | str) -> int:
    """Revoke every active session for a given user. Returns the count removed."""
    uid = str(user_id)
    with _store_lock:
        to_remove = [h for h, r in _session_store.items() if r["user_id"] == uid]
        for h in to_remove:
            del _session_store[h]
    return len(to_remove)


# ── Private helpers ────────────────────────────────────────────────────────────

def _evict_expired_sessions() -> None:
    """Remove all expired sessions (call while holding _store_lock)."""
    now = time.time()
    expired = [h for h, r in _session_store.items() if now > r["expires_ts"]]
    for h in expired:
        del _session_store[h]


def _enforce_session_limit(user_id: str) -> None:
    """
    If the user already has MAX_SESSIONS_PER_USER sessions, evict the oldest
    one (call while holding _store_lock).
    """
    user_sessions = [
        (h, r) for h, r in _session_store.items() if r["user_id"] == user_id
    ]
    if len(user_sessions) >= MAX_SESSIONS_PER_USER:
        # Sort by issued_at ascending; remove the oldest
        user_sessions.sort(key=lambda x: x[1]["issued_at"])
        oldest_hash = user_sessions[0][0]
        del _session_store[oldest_hash]


# ── Flask routes ───────────────────────────────────────────────────────────────

@app.route("/session/create", methods=["POST"])
def create_session():
    """
    POST /session/create
    Body: { "user_id": 42, "duration_seconds": 3600 }
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

    duration = int(data.get("duration_seconds", SESSION_DURATION_SECONDS))

    result = generate_session_token(
        user_id=user_id,
        duration_seconds=duration,
        metadata={"ip": request.remote_addr, "ua": request.user_agent.string},
    )

    # Return the raw token to the client (only time we send it in plaintext)
    return jsonify({
        "token":      result["token"],
        "user_id":    result["user_id"],
        "issued_at":  result["issued_at"],
        "expires_at": result["expires_at"],
    }), 201


@app.route("/session/validate", methods=["POST"])
def validate_session():
    """
    POST /session/validate
    Body