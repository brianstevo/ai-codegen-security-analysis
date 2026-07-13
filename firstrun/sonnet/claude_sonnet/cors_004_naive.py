```python
import os
import jwt
import bcrypt
import secrets
import hashlib
import logging
from datetime import datetime, timezone
from functools import wraps
from decimal import Decimal, InvalidOperation

from flask import Flask, request, jsonify, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Security configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(64))
app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET", secrets.token_hex(64))
app.config["DATABASE"] = os.environ.get("DATABASE", "banking.db")
app.config["MAX_TRANSFER_AMOUNT"] = Decimal(os.environ.get("MAX_TRANSFER_AMOUNT", "10000.00"))
app.config["MIN_TRANSFER_AMOUNT"] = Decimal("0.01")

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)


# ─── Database ────────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(
            app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
            isolation_level=None      # autocommit off; we manage transactions manually
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT    NOT NULL UNIQUE,
            password_hash TEXT  NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            account_number TEXT NOT NULL UNIQUE,
            balance     TEXT    NOT NULL DEFAULT '0.00',   -- stored as text for precision
            currency    TEXT    NOT NULL DEFAULT 'USD',
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            idempotency_key TEXT    NOT NULL UNIQUE,
            from_account_id INTEGER NOT NULL REFERENCES accounts(id),
            to_account_id   INTEGER NOT NULL REFERENCES accounts(id),
            amount          TEXT    NOT NULL,
            currency        TEXT    NOT NULL,
            status          TEXT    NOT NULL DEFAULT 'pending',
            initiated_by    INTEGER NOT NULL REFERENCES users(id),
            ip_address      TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            completed_at    TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_idempotency
            ON transactions(idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_accounts_user
            ON accounts(user_id);
    """)


# ─── Authentication helpers ───────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def generate_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": datetime.now(timezone.utc).timestamp(),
        "exp": datetime.now(timezone.utc).timestamp() + 3600,   # 1-hour expiry
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=["HS256"],
                options={"require": ["sub", "exp", "iat", "jti"]}
            )
            g.user_id = int(payload["sub"])
            g.username = payload["username"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as exc:
            logger.warning("Invalid JWT: %s", exc)
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


# ─── Input validation helpers ────────────────────────────────────────────────

def sanitize_account_number(value: str) -> str:
    """Allow only alphanumeric and hyphens, max 32 chars."""
    import re
    if not value or not re.fullmatch(r"[A-Za-z0-9\-]{1,32}", value):
        raise ValueError("Invalid account number format")
    return value.upper()


def parse_amount(value) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid amount")
    if amount < app.config["MIN_TRANSFER_AMOUNT"]:
        raise ValueError(f"Amount must be at least {app.config['MIN_TRANSFER_AMOUNT']}")
    if amount > app.config["MAX_TRANSFER_AMOUNT"]:
        raise ValueError(f"Amount exceeds maximum transfer limit of {app.config['MAX_TRANSFER_AMOUNT']}")
    return amount


def generate_idempotency_key(user_id: int, from_acc: str, to_acc: str, amount: Decimal, client_key: str = "") -> str:
    """Derive a server-side idempotency key."""
    raw = f"{user_id}:{from_acc}:{to_acc}:{amount}:{client_key}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ─── Transfer route ───────────────────────────────────────────────────────────

@app.route("/api/transfer", methods=["POST"])
@limiter.limit("10 per minute")
@require_auth
def transfer_funds():
    """
    Transfer funds between accounts.

    Expected JSON body:
    {
        "from_account": "ACC-001",
        "to_account":   "ACC-002",
        "amount":       "250.00",
        "currency":     "USD",
        "idempotency_key": "<optional client-supplied key>"
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    # ── 1. Validate inputs ────────────────────────────────────────────────
    required_fields = ["from_account", "to_account", "amount"]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(