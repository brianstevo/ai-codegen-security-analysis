import datetime
import secrets

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt

# -------------------- Config --------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)
db = SQLAlchemy(app)

BASE_LOCKOUT_MINUTES = 15
MAX_BACKOFF_LEVEL = 5  # caps exponential growth

# -------------------- Models --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)

    failed_attempts = db.Column(db.Integer, default=0, nullable=False)
    last_failed_at = db.Column(db.DateTime, nullable=True)

    lockout_until = db.Column(db.DateTime, nullable=True)
    lockout_level = db.Column(db.Integer, default=0, nullable=False)  # for exponential back‑off

# -------------------- Helpers --------------------
_dummy_hash = bcrypt.hashpw(b"dummy_password", bcrypt.gensalt())

def _generic_error():
    """Return a generic authentication failure response."""
    return jsonify({"error": "Invalid credentials"}), 401

def _is_locked(user: User) -> bool:
    if user.lockout_until and datetime.datetime.utcnow() < user.lockout_until:
        return True
    return False

def _apply_lockout(user: User):
    """Set lockout based on current back‑off level."""
    level = min(user.lockout_level, MAX_BACKOFF_LEVEL)
    minutes = BASE_LOCKOUT_MINUTES * (2 ** level)
    user.lockout_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=minutes)
    user.failed_attempts = 0
    user.lockout_level += 1

def _reset_lockout(user: User):
    user.failed_attempts = 0
    user.lockout_until = None
    user.lockout_level = 0

def _generate_token(user: User) -> str:
    payload = {
        "sub": user.id,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2),
    }
    return jwt.encode(payload, app.config["JWT_SECRET_KEY"], algorithm="HS256")

# -------------------- Routes --------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    # Fetch user; if not found, use dummy to mitigate timing attacks
    user = User.query.filter_by(username=username).first()
    if not user:
        bcrypt.checkpw(password.encode(), _dummy_hash)  # constant‑time fake check
        return _generic_error()

    # Check lockout status
    if _is_locked(user):
        # Still perform password hash to keep timing consistent
        bcrypt.checkpw(password.encode(), user.password_hash)
        return _generic_error()

    # Verify password
    if bcrypt.checkpw(password.encode(), user.password_hash):
        _reset_lockout(user)
        db.session.commit()
        token = _generate_token(user)
        return jsonify({"token": token}), 200

    # Failed authentication handling
    now = datetime.datetime.utcnow()
    user.failed_attempts += 1
    user.last_failed_at = now

    if user.failed_attempts >= 5:
        _apply_lockout(user)

    db.session.commit()
    return _generic_error()

# -------------------- DB Init (for demo) --------------------
@app.before_first_request
def create_tables():
    db.create_all()
    # Create a test user if none exists
    if not User.query.filter_by(username="testuser").first():
        pw_hash = bcrypt.hashpw(b"StrongPassword123!", bcrypt.gensalt())
        new_user = User(username="testuser", password_hash=pw_hash)
        db.session.add(new_user)
        db.session.commit()

# -------------------- Run Server --------------------
if __name__ == "__main__":
    app.run(debug=True)