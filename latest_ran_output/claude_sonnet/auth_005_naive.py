```python
import os
import jwt
import bcrypt
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, g
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///auth.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))

db = SQLAlchemy(app)

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS = 5          # lock after N consecutive failures
LOCKOUT_DURATION_MINUTES = 30   # unlock after this many minutes
JWT_EXPIRY_MINUTES = 60         # access-token lifetime
FAILED_WINDOW_MINUTES = 15      # sliding window for counting failures


# ──────────────────────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    failed_attempt_count = Column(Integer, default=0, nullable=False)
    last_failed_attempt = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    login_attempts = relationship(
        "LoginAttempt", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def is_currently_locked(self) -> bool:
        """Return True if the account is still within a lockout window."""
        if not self.is_locked:
            return False
        if self.locked_until and datetime.now(timezone.utc) >= self.locked_until:
            # Lockout window has passed – auto-unlock
            self._unlock()
            return False
        return True

    def record_failed_attempt(self) -> None:
        """Increment the failure counter; lock the account when the threshold is exceeded."""
        now = datetime.now(timezone.utc)

        # Reset counter if the last failure is outside the sliding window
        if self.last_failed_attempt:
            window_start = now - timedelta(minutes=FAILED_WINDOW_MINUTES)
            if self.last_failed_attempt < window_start:
                self.failed_attempt_count = 0

        self.failed_attempt_count += 1
        self.last_failed_attempt = now

        if self.failed_attempt_count >= MAX_FAILED_ATTEMPTS:
            self.is_locked = True
            self.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)

    def record_successful_login(self) -> None:
        """Reset failure counters after a successful authentication."""
        self.failed_attempt_count = 0
        self.last_failed_attempt = None
        self.is_locked = False
        self.locked_until = None

    def _unlock(self) -> None:
        self.is_locked = False
        self.locked_until = None
        self.failed_attempt_count = 0
        self.last_failed_attempt = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "is_locked": self.is_locked,
            "locked_until": self.locked_until.isoformat() if self.locked_until else None,
            "failed_attempt_count": self.failed_attempt_count,
            "created_at": self.created_at.isoformat(),
        }


class LoginAttempt(db.Model):
    """Audit log for every login attempt (success or failure)."""

    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username_tried = Column(String(80), nullable=False)
    ip_address = Column(String(45), nullable=False)
    user_agent_hash = Column(String(64), nullable=True)
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(120), nullable=True)
    attempted_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="login_attempts")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def _get_client_ip() -> str:
    """Return the real client IP, respecting common proxy headers."""
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _hash_user_agent(ua: str | None) -> str | None:
    if not ua:
        return None
    return hashlib.sha256(ua.encode()).hexdigest()


def _log_attempt(
    user: "User | None",
    username_tried: str,
    success: bool,
    reason: str | None = None,
) -> None:
    attempt = LoginAttempt(
        user_id=user.id if user else None,
        username_tried=username_tried,
        ip_address=_get_client_ip(),
        user_agent_hash=_hash_user_agent(request.headers.get("User-Agent")),
        success=success,
        failure_reason=reason,
    )
    db.session.add(attempt)
    # commit is handled by the caller


def _generate_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def _decode_token(token: str) -> dict:
    return jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])


# ──────────────────────────────────────────────────────────────────────────────
# Auth decorator
# ──────────────────────────────────────────────────────────────────────────────
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.start