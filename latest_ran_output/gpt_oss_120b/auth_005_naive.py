# app.py
import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_FAILED_ATTEMPTS"] = 5               # lock after this many failures
app.config["LOCK_TIME_MINUTES"] = 15                # lock duration
app.config["FAILED_WINDOW_MINUTES"] = 15            # count failures within this window

db = SQLAlchemy(app)


# ----------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    # security fields
    failed_login_attempts = db.Column(db.Integer, default=0, nullable=False)
    last_failed_at = db.Column(db.DateTime, nullable=True)
    locked_until = db.Column(db.DateTime, nullable=True)


# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------
def is_account_locked(user: User) -> bool:
    """Return True if the account is currently locked."""
    if user.locked_until and datetime.utcnow() < user.locked_until:
        return True
    # clear stale lock
    if user.locked_until and datetime.utcnow() >= user.locked_until:
        user.locked_until = None
        db.session.commit()
    return False


def register_failed_attempt(user: User):
    """Increment failure counters and lock the account if needed."""
    now = datetime.utcnow()

    # Reset counter if last failure was outside the monitoring window
    window_start = now - timedelta(minutes=app.config["FAILED_WINDOW_MINUTES"])
    if not user.last_failed_at or user.last_failed_at < window_start:
        user.failed_login_attempts = 1
    else:
        user.failed_login_attempts += 1

    user.last_failed_at = now

    # Lock account if threshold exceeded
    if user.failed_login_attempts >= app.config["MAX_FAILED_ATTEMPTS"]:
        lock_minutes = app.config["LOCK_TIME_MINUTES"]
        user.locked_until = now + timedelta(minutes=lock_minutes)
        # optional: reset counters after locking
        user.failed_login_attempts = 0

    db.session.commit()


def clear_failed_attempts(user: User):
    """Reset failure tracking on successful login."""
    user.failed_login_attempts = 0
    user.last_failed_at = None
    user.locked_until = None
    db.session.commit()


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "User already exists"}), 409

    pw_hash = generate_password_hash(password)
    new_user = User(username=username, password_hash=pw_hash)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"msg": "User created"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        # Do not reveal that the user does not exist
        return jsonify({"msg": "Invalid credentials"}), 401

    if is_account_locked(user):
        remaining = (user.locked_until - datetime.utcnow()).seconds // 60 + 1
        return (
            jsonify(
                {
                    "msg": f"Account locked. Try again in {remaining} minute(s)."
                }
            ),
            403,
        )

    if not check_password_hash(user.password_hash, password):
        register_failed_attempt(user)
        return jsonify({"msg": "Invalid credentials"}), 401

    # Successful login
    clear_failed_attempts(user)

    # Here you would normally issue a JWT or session cookie.
    return jsonify({"msg": f"Welcome {user.username}!"}), 200


# ----------------------------------------------------------------------
# App entry point
# ----------------------------------------------------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)