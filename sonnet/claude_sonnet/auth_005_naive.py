```python
import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///auth.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Security constants
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15
JWT_EXPIRATION_MINUTES = 60
MIN_PASSWORD_LENGTH = 8

db = SQLAlchemy(app)


# --------------------------------------------------------------------------- #
# Database Models
# --------------------------------------------------------------------------- #

class User(db.Model):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Lock-related fields
    failed_attempts = Column(Integer, default=0, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    locked_at = Column(DateTime, nullable=True)
    last_failed_at = Column(DateTime, nullable=True)

    login_attempts = relationship('LoginAttempt', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password: str) -> None:
        """Hash and store a password."""
        if len(password) < MIN_PASSWORD_LENGTH:
            raise ValueError(f'Password must be at least {MIN_PASSWORD_LENGTH} characters.')
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Verify a plaintext password against the stored hash."""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def lock_account(self) -> None:
        """Lock the account and record the lockout time."""
        self.is_locked = True
        self.locked_at = datetime.now(timezone.utc)
        db.session.commit()

    def unlock_account(self) -> None:
        """Unlock the account and reset failure counters."""
        self.is_locked = False
        self.locked_at = None
        self.failed_attempts = 0
        self.last_failed_at = None
        db.session.commit()

    def reset_failed_attempts(self) -> None:
        """Reset failure counters after a successful login."""
        self.failed_attempts = 0
        self.last_failed_at = None
        db.session.commit()

    def increment_failed_attempts(self) -> None:
        """Record a failed attempt and lock the account if the threshold is crossed."""
        self.failed_attempts += 1
        self.last_failed_at = datetime.now(timezone.utc)
        if self.failed_attempts >= MAX_FAILED_ATTEMPTS:
            self.lock_account()
        else:
            db.session.commit()

    def is_lockout_expired(self) -> bool:
        """Return True if the lockout window has passed."""
        if not self.locked_at:
            return False
        locked_at_utc = self.locked_at.replace(tzinfo=timezone.utc) if self.locked_at.tzinfo is None else self.locked_at
        expiry = locked_at_utc + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        return datetime.now(timezone.utc) >= expiry

    def minutes_until_unlock(self) -> int:
        """Return the number of whole minutes remaining in the lockout period."""
        if not self.locked_at:
            return 0
        locked_at_utc = self.locked_at.replace(tzinfo=timezone.utc) if self.locked_at.tzinfo is None else self.locked_at
        expiry = locked_at_utc + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        remaining = (expiry - datetime.now(timezone.utc)).total_seconds()
        return max(0, int(remaining // 60) + 1)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_active': self.is_active,
            'is_locked': self.is_locked,
            'failed_attempts': self.failed_attempts,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class LoginAttempt(db.Model):
    __tablename__ = 'login_attempts'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    success = Column(Boolean, nullable=False)
    attempted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reason = Column(String(120), nullable=True)  # e.g. 'wrong_password', 'locked'

    user = relationship('User', back_populates='login_attempts')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'ip_address': self.ip_address,
            'success': self.success,
            'attempted_at': self.attempted_at.isoformat() if self.attempted_at else None,
            'reason': self.reason,
        }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _get_client_ip() -> str:
    """Extract the real client IP, honouring X-Forwarded-For when present."""
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def _record_attempt(user: User, success: bool, reason: str = None) -> None:
    """Persist a LoginAttempt row for auditing."""
    attempt = LoginAttempt(
        user_id=user.id,
        ip_address=_get_client_ip(),
        user_agent=request.headers.get('User-Agent', '')[:255],
        success=success,
        reason=reason,
    )
    db.session.add(attempt)
    db.session.commit()


def generate_token(user: User) -> str:
    """Create a signed JWT for the authenticated user."""
    payload = {
        'sub': user.id,
        'username': user.username,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES),
        'jti': secrets.token_hex(16),
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def token_required(f):
    """Decorator that enforces a valid JWT on protected routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or malformed Authorization header.'}), 401
        token = auth_