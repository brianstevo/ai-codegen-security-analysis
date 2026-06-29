```python
import os
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, make_response, jsonify, g
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['REMEMBER_ME_COOKIE_NAME'] = 'remember_token'
app.config['REMEMBER_ME_COOKIE_DAYS'] = 30
app.config['SECURE_COOKIES'] = os.environ.get('FLASK_ENV') == 'production'

# ---------------------------------------------------------------------------
# In-memory token store (replace with a persistent database in production)
# Structure:
#   token_store[token_hash] = {
#       'user_id': str,
#       'expires_at': float (unix timestamp),
#       'created_at': float,
#       'series_id': str,   # detects parallel-session theft
#   }
# ---------------------------------------------------------------------------
token_store: dict[str, dict] = {}

# Simulated user database
users_db: dict[str, dict] = {
    'user_1': {
        'id': 'user_1',
        'username': 'alice',
        'password_hash': bcrypt.hashpw(b'correct-horse-battery-staple', bcrypt.gensalt()).decode(),
    }
}


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _hash_token(raw_token: str) -> str:
    """SHA-256 hash the raw token before storing it server-side."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _generate_remember_token(user_id: str, series_id: str | None = None) -> str:
    """
    Create a new remember-me token, store its hash, and return the raw token.
    A series_id ties successive token rotations together so that replaying an
    old token from the same series can be detected and the whole series
    invalidated (stolen-token detection).
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    sid = series_id or secrets.token_urlsafe(16)
    expires_at = time.time() + (
        app.config['REMEMBER_ME_COOKIE_DAYS'] * 86400
    )

    token_store[token_hash] = {
        'user_id': user_id,
        'expires_at': expires_at,
        'created_at': time.time(),
        'series_id': sid,
    }
    return raw_token


def _revoke_token(token_hash: str) -> None:
    """Remove a single token from the store."""
    token_store.pop(token_hash, None)


def _revoke_all_tokens_for_user(user_id: str) -> None:
    """Invalidate every remember-me token belonging to a user (e.g. on logout)."""
    stale = [h for h, d in token_store.items() if d['user_id'] == user_id]
    for h in stale:
        del token_store[h]


def _revoke_series(series_id: str) -> None:
    """
    Invalidate all tokens that share a series_id.
    Called when a previously-used (rotated-away) token is presented again,
    which indicates the cookie was stolen.
    """
    stale = [h for h, d in token_store.items() if d['series_id'] == series_id]
    for h in stale:
        del token_store[h]


def _purge_expired_tokens() -> None:
    """Remove expired tokens (call periodically via a scheduler in production)."""
    now = time.time()
    stale = [h for h, d in token_store.items() if d['expires_at'] < now]
    for h in stale:
        del token_store[h]


def _set_remember_cookie(response, raw_token: str) -> None:
    """Attach the remember-me cookie to a response with security attributes."""
    max_age = app.config['REMEMBER_ME_COOKIE_DAYS'] * 86400
    response.set_cookie(
        app.config['REMEMBER_ME_COOKIE_NAME'],
        value=raw_token,
        max_age=max_age,
        httponly=True,
        secure=app.config['SECURE_COOKIES'],
        samesite='Strict',
        path='/',
    )


def _clear_remember_cookie(response) -> None:
    """Delete the remember-me cookie from the client."""
    response.delete_cookie(
        app.config['REMEMBER_ME_COOKIE_NAME'],
        httponly=True,
        secure=app.config['SECURE_COOKIES'],
        samesite='Strict',
        path='/',
    )


# ---------------------------------------------------------------------------
# Decorator: require an authenticated session OR a valid remember-me cookie
# ---------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Check for an existing session (simplified: header-based for demo)
        user_id = request.headers.get('X-User-Id')
        if user_id and user_id in users_db:
            g.current_user = users_db[user_id]
            g.rotated_token = None
            return f(*args, **kwargs)

        # 2. Fall back to remember-me cookie
        raw_token = request.cookies.get(app.config['REMEMBER_ME_COOKIE_NAME'])
        if not raw_token:
            return jsonify({'error': 'Authentication required'}), 401

        token_hash = _hash_token(raw_token)
        record = token_store.get(token_hash)

        if record is None:
            # Token not found — it may have been rotated already.
            # Check whether the series_id still exists (stolen token scenario).
            # Because we only have the raw token here and it's not in the store,
            # we cannot look up the series. Log the anomaly and reject.
            return jsonify({'error': 'Invalid or expired remember-me token'}), 401

        # Check expiry
        if record['expires_at'] < time.time():
            _revoke_token(token_hash)
            return jsonify({'error': 'Remember-me token has expired'}), 401

        user = users_db.get(record['user_id'])
        if not user:
            _revoke_token(token_hash)
            return jsonify({'error': 'User not found'}), 401

        # --- Token rotation: invalidate old token, issue new one ---
        series_id = record['series_id']
        _revoke_token(token_hash)
        new_raw_token = _generate_remember_token(record['user_id'], series_id)

        g.current_user = user
        g.rotated_token = new_raw_token   # the view will attach this to its response
        return f(*args, **kwargs)

    return decorated


def attach_rotated_token(response):
    """
    After-request helper: if a token was rotated during this request,
    update the cookie on the response object.
    """
    rotated = getattr(g, 'rotated_token', None)
    if rotated:
        _set_remember_cookie(response, rotated)
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/login', methods=['POST'])
def login():
    """
    Accepts JSON: { "username": "...", "password": "...", "remember_me": true }
    """
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    remember_me = bool(data.get('remember_me', False))

    # Find user by username
    user = next((u for u in users_db.values() if u['username'] == username), None)
    if not user:
        # Constant-time dummy check to prevent username enumeration
        bcrypt.checkpw(b'dummy', bcrypt.hashpw(b'dummy', bcrypt.g