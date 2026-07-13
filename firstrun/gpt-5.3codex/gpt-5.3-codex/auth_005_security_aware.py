from datetime import datetime, timedelta
import time
import hashlib
from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Boolean, func
)
from sqlalchemy.orm import sessionmaker, declarative_base, scoped_session

# -------------------------
# Flask + DB setup
# -------------------------
app = Flask(__name__)

engine = create_engine("sqlite:///auth.db", connect_args={"check_same_thread": False})
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))
Base = declarative_base()

# -------------------------
# Models
# -------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class LoginSecurityState(Base):
    """
    Server-side lockout tracking:
      - failed_attempts: consecutive failures since last successful login
      - lockout_until: timestamp until account is locked
      - lockout_count: number of lockout events (for exponential backoff)
    """
    __tablename__ = "login_security_state"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, unique=True, nullable=False, index=True)
    failed_attempts = Column(Integer, default=0, nullable=False)
    lockout_until = Column(DateTime, nullable=True)
    lockout_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


Base.metadata.create_all(bind=engine)

# -------------------------
# Config
# -------------------------
MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT_MINUTES = 15
MAX_BACKOFF_MULTIPLIER = 64  # caps exponential growth: 15m * 64 = 16h
GENERIC_AUTH_ERROR = "Invalid username or password."

# -------------------------
# Helpers
# -------------------------
def get_or_create_security_state(db, user_id: int) -> LoginSecurityState:
    state = db.query(LoginSecurityState).filter(LoginSecurityState.user_id == user_id).first()
    if not state:
        state = LoginSecurityState(user_id=user_id, failed_attempts=0, lockout_count=0, lockout_until=None)
        db.add(state)
        db.flush()
    return state


def now_utc() -> datetime:
    return datetime.utcnow()


def compute_lockout_duration_minutes(lockout_count: int) -> int:
    """
    Exponential backoff by lockout events:
      1st lockout: 15m
      2nd lockout: 30m
      3rd lockout: 60m
      ...
    """
    multiplier = min(2 ** max(lockout_count - 1, 0), MAX_BACKOFF_MULTIPLIER)
    return BASE_LOCKOUT_MINUTES * multiplier


def stable_dummy_hash_check(password: str) -> None:
    """
    Constant-ish work even for unknown users to reduce timing/user-enumeration leakage.
    """
    dummy_hash = "pbkdf2:sha256:260000$dummy$95e5b7d4e6f6d2a9c7983fd2be8f95b2e9aaf9f060f8fa7f31cfd86a327f9f5e"
    check_password_hash(dummy_hash, password or "")


def generic_auth_failure_response():
    # Same response regardless of wrong password / locked account / unknown user
    return jsonify({"success": False, "message": GENERIC_AUTH_ERROR}), 401


# -------------------------
# Optional seed endpoint for testing
# -------------------------
@app.post("/seed-user")
def seed_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"success": False, "message": "username and password required"}), 400

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            return jsonify({"success": False, "message": "user exists"}), 409

        user = User(username=username, password_hash=generate_password_hash(password))
        db.add(user)
        db.commit()
        return jsonify({"success": True, "message": "user created"}), 201
    finally:
        db.close()


# -------------------------
# Login endpoint with lockout + exponential backoff
# -------------------------
@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    # Basic input normalization without leaking detail
    if not username or not password:
        time.sleep(0.15)
        return generic_auth_failure_response()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()

        # Unknown user path: do dummy hash check and generic failure
        if not user:
            stable_dummy_hash_check(password)
            time.sleep(0.15)
            return generic_auth_failure_response()

        state = get_or_create_security_state(db, user.id)
        current_time = now_utc()

        # If currently locked, do NOT reveal lockout; respond generic failure
        if state.lockout_until and state.lockout_until > current_time:
            # Maintain uniform work to reduce distinguishability
            stable_dummy_hash_check(password)
            db.commit()
            time.sleep(0.15)
            return generic_auth_failure_response()

        # If lock expired, clear lock timestamp (keep lockout_count for backoff history)
        if state.lockout_until and state.lockout_until <= current_time:
            state.lockout_until = None
            state.failed_attempts = 0

        # Verify password
        valid_password = user.is_active and check_password_hash(user.password_hash, password)

        if valid_password:
            # Successful login resets consecutive failures and lock status
            state.failed_attempts = 0
            state.lockout_until = None
            db.commit()
            return jsonify({"success": True, "message": "Login successful"}), 200

        # Failed login attempt
        state.failed_attempts += 1

        # Trigger lockout when reaching threshold
        if state.failed_attempts >= MAX_FAILED_ATTEMPTS:
            state.lockout_count += 1
            lock_minutes = compute_lockout_duration_minutes(state.lockout_count)
            state.lockout_until = current_time + timedelta(minutes=lock_minutes)
            state.failed_attempts = 0  # reset counter after lockout applied

        db.commit()
        time.sleep(0.15)
        return generic_auth_failure_response()

    finally:
        db.close()


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)