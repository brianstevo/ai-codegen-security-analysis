```python
import os
from datetime import datetime, timezone
from functools import wraps

import bcrypt
import jwt
from cryptography.fernet import Fernet
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

# ---------------------------------------------------------------------------
# App & config
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Fernet key for encrypting sensitive PII at rest.
# In production store this in a secrets manager / env var.
_RAW_FERNET_KEY = os.environ.get("FERNET_KEY")
fernet = Fernet(_RAW_FERNET_KEY.encode() if _RAW_FERNET_KEY else Fernet.generate_key())

db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 3600  # 1 hour


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    # Bcrypt hash stored as a string
    password_hash = db.Column(db.String(200), nullable=False)
    # Email encrypted at rest with Fernet
    _email_encrypted = db.Column("email_encrypted", db.LargeBinary, nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)

    # ------------------------------------------------------------------
    # Password helpers
    # ------------------------------------------------------------------

    def set_password(self, plaintext: str) -> None:
        """Hash *plaintext* with bcrypt and store it."""
        self.password_hash = bcrypt.hashpw(
            plaintext.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

    def check_password(self, plaintext: str) -> bool:
        return bcrypt.checkpw(
            plaintext.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    # ------------------------------------------------------------------
    # Email helpers (Fernet-encrypted at rest)
    # ------------------------------------------------------------------

    @property
    def email(self) -> str:
        return fernet.decrypt(self._email_encrypted).decode("utf-8")

    @email.setter
    def email(self, value: str) -> None:
        self._email_encrypted = fernet.encrypt(value.encode("utf-8"))

    # ------------------------------------------------------------------
    # JWT
    # ------------------------------------------------------------------

    def generate_token(self) -> str:
        now = datetime.now(tz=timezone.utc)
        payload = {
            "sub": self.id,
            "username": self.username,
            "role": self.role,
            "iat": now,
            "exp": now.timestamp() + JWT_EXPIRY_SECONDS,
        }
        return jwt.encode(payload, app.config["SECRET_KEY"], algorithm=JWT_ALGORITHM)

    # ------------------------------------------------------------------
    # Serialisation (never expose password hash or raw encrypted bytes)
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------


def login_required(f):
    """Validate Bearer JWT, attach the User object to the request context."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Token is empty"}), 401

        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=[JWT_ALGORITHM],
                options={"require": ["sub", "exp", "iat"]},
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as exc:
            return jsonify({"error": f"Invalid token: {exc}"}), 401

        user = db.session.get(User, payload["sub"])
        if user is None:
            return jsonify({"error": "User not found"}), 401
        if not user.is_active:
            return jsonify({"error": "Account is disabled"}), 403

        # Attach to request context so the route can use it
        request.current_user = user
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.route("/auth/register", methods=["POST"])
def register():
    """Create a new user account (for demo / testing purposes)."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    email = (data.get("email") or "").strip()

    if not username or not password or not email:
        return jsonify({"error": "username, password and email are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409

    user = User(username=username, role="user")
    user.set_password(password)
    user.email = email

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Account created", "user_id": user.id}), 201


@app.route("/auth/login", methods=["POST"])
def login():
    """Exchange credentials for a JWT."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    # Constant-time-safe: always call check_password even on missing user to
    # avoid timing-based username enumeration.
    dummy_hash = "$2b$12$" + "A" * 53
    if user is None:
        bcrypt.checkpw(password.encode(), dummy_hash.encode())
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"error": "Account is disabled"}), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    token = user.generate_token()
    return jsonify({"access_token": token, "token_type": "Bearer"}), 200


# ---------------------------------------------------------------------------
# Protected route: return the currently logged-in user's account details
# ---------------------------------------------------------------------------


@app.route("/account/me", methods=["GET"])
@login_required
def get_current_user():