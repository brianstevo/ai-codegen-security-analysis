```python
import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from cryptography.fernet import Fernet
from flask import Flask, request, jsonify, make_response, g
from flask_sqlalchemy import SQLAlchemy

# ---------------------------------------------------------------------------
# App & config
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///remember_me.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Fernet key for encrypting remember-me tokens stored in the DB
_RAW_FERNET_KEY = os.environ.get("FERNET_KEY", Fernet.generate_key().decode())
fernet = Fernet(_RAW_FERNET_KEY.encode() if isinstance(_RAW_FERNET_KEY, str) else _RAW_FERNET_KEY)

db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REMEMBER_ME_DAYS = 30
JWT_ACCESS_EXPIRES = timedelta(hours=1)
REMEMBER_ME_COOKIE = "remember_token"
ACCESS_TOKEN_COOKIE = "access_token"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    remember_tokens = db.relationship(
        "RememberToken", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self) -> dict:
        return {"id": self.id, "username": self.username, "email": self.email}


class RememberToken(db.Model):
    """
    Stores a *hashed* selector+validator pair (split-token approach).

    The cookie value is  <selector>:<validator>  (both random hex strings).
    Only the SHA-256 hash of the validator is stored in the DB so that a
    database leak cannot be used to hijack sessions directly.
    """

    __tablename__ = "remember_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # 16-byte selector – used to look up the row efficiently
    selector = db.Column(db.String(64), unique=True, nullable=False, index=True)
    # SHA-256 hash of the 32-byte validator
    validator_hash = db.Column(db.String(128), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    last_used_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Optional: bind to IP / user-agent for extra security
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(256))

    user = db.relationship("User", back_populates="remember_tokens")

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _generate_remember_me_token() -> tuple[str, str, str]:
    """
    Returns (cookie_value, selector, validator).

    cookie_value = "<selector>:<validator>"
    """
    selector = secrets.token_hex(16)   # 32 hex chars
    validator = secrets.token_hex(32)  # 64 hex chars
    cookie_value = f"{selector}:{validator}"
    return cookie_value, selector, validator


def _hash_validator(validator: str) -> str:
    return hashlib.sha256(validator.encode("utf-8")).hexdigest()


def _create_access_jwt(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + JWT_ACCESS_EXPIRES,
        "type": "access",
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def _decode_access_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat"]},
        )
    except jwt.PyJWTError:
        return None


def _set_auth_cookies(response, access_token: str, remember_token: str | None = None):
    """Attach httpOnly, secure, samesite cookies to a response."""
    # Short-lived access JWT
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        access_token,
        httponly=True,
        secure=True,          # set to False for local HTTP testing
        samesite="Lax",
        max_age=int(JWT_ACCESS_EXPIRES.total_seconds()),
    )
    # Long-lived remember-me token
    if remember_token:
        response.set_cookie(
            REMEMBER_ME_COOKIE,
            remember_token,
            httponly=True,
            secure=True,
            samesite="Lax",
            max_age=REMEMBER_ME_DAYS * 24 * 60 * 60,
        )


def _clear_auth_cookies(response):
    response.delete_cookie(ACCESS_TOKEN_COOKIE)
    response.delete_cookie(REMEMBER_ME_COOKIE)


# ---------------------------------------------------------------------------
# Remember-me core logic
# ---------------------------------------------------------------------------

def issue_remember_me_token(user: User, request_ctx) -> str:
    """
    Creates a new RememberToken DB row and returns the raw cookie value.
    Old tokens for the same user+IP are NOT deleted here – call
    rotate_remember_me_token() on subsequent requests instead.
    """
    cookie_value, selector, validator = _generate_remember_me_token()

    token = RememberToken(
        user_id=user.id,
        selector=selector,
        validator_hash=_hash_validator(validator),
        expires_at=datetime.utcnow() + timedelta(days=REMEMBER_ME_DAYS),
        ip_address=request_ctx.remote_addr,
        user_agent=request_ctx.user_agent.string[:256],
    )
    db.session.add(token)
    db.session.commit()
    return cookie_value


def validate_remember_me_token(cookie_value: str) -> User | None:
    """
    Validates the remember-me cookie.

    Returns the associated User on success, None otherwise.
    Detects token theft via timing-safe comparison of the validator hash.
    """
    if not cookie_value or ":" not in cookie_value:
        return None

    selector, _, validator = cookie_value.partition(":")

    token_row = RememberToken.query.filter_by(selector=selector).first()
    if token_row is None:
        return None

    if token_row.is_expired:
        db.