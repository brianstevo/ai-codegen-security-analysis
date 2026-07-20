```python
import re
import secrets
import hashlib
from datetime import datetime, timezone
from functools import wraps

import bcrypt
import jwt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from cryptography.fernet import Fernet

# ---------------------------------------------------------------------------
# App / config
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = secrets.token_hex(32)          # replace with env var
app.config["FERNET_KEY"] = Fernet.generate_key()          # replace with env var

db = SQLAlchemy(app)
fernet = Fernet(app.config["FERNET_KEY"])

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id              = db.Column(db.Integer, primary_key=True)
    username        = db.Column(db.String(64),  unique=True, nullable=False)
    email           = db.Column(db.String(254),  unique=True, nullable=False)
    password_hash   = db.Column(db.String(256), nullable=False)
    email_encrypted = db.Column(db.LargeBinary, nullable=False)   # reversible storage
    email_hmac      = db.Column(db.String(64),  unique=True, nullable=False)  # lookup
    verification_token = db.Column(db.String(128), nullable=True)
    is_verified     = db.Column(db.Boolean, default=False, nullable=False)
    is_active       = db.Column(db.Boolean, default=True,  nullable=False)
    created_at      = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login      = db.Column(db.DateTime, nullable=True)

    def set_password(self, plaintext: str) -> None:
        """Hash plaintext password with bcrypt and store the result."""
        self.password_hash = bcrypt.hashpw(
            plaintext.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

    def check_password(self, plaintext: str) -> bool:
        return bcrypt.checkpw(
            plaintext.encode("utf-8"),
            self.password_hash.encode("utf-8"),
        )

    def to_safe_dict(self) -> dict:
        return {
            "id":          self.id,
            "username":    self.username,
            "email":       self.email,
            "is_verified": self.is_verified,
            "created_at":  self.created_at.isoformat(),
        }


with app.app_context():
    db.create_all()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", re.IGNORECASE)
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,64}$")

# Minimum 8 chars, at least one uppercase, one lowercase, one digit, one special
PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).{8,128}$")

RESERVED_USERNAMES = frozenset({
    "admin", "root", "system", "superuser", "moderator",
    "support", "help", "api", "null", "undefined",
})


def _hmac_email(email: str) -> str:
    """Deterministic HMAC for email look-ups (case-normalised)."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        email.lower().strip().encode(),
        app.config["SECRET_KEY"].encode(),
        iterations=100_000,
    ).hex()


def validate_registration_data(data: dict) -> list[str]:
    """Return a list of human-readable error strings (empty = valid)."""
    errors: list[str] = []

    # --- username ---
    username = (data.get("username") or "").strip()
    if not username:
        errors.append("Username is required.")
    elif not USERNAME_RE.match(username):
        errors.append(
            "Username must be 3–64 characters and contain only letters, "
            "digits, underscores, hyphens, or periods."
        )
    elif username.lower() in RESERVED_USERNAMES:
        errors.append("That username is reserved.")

    # --- email ---
    email = (data.get("email") or "").strip()
    if not email:
        errors.append("Email address is required.")
    elif not EMAIL_RE.match(email):
        errors.append("Please supply a valid email address.")
    elif len(email) > 254:
        errors.append("Email address is too long.")

    # --- password ---
    password = data.get("password") or ""
    if not password:
        errors.append("Password is required.")
    elif not PASSWORD_RE.match(password):
        errors.append(
            "Password must be 8–128 characters and include at least one "
            "uppercase letter, one lowercase letter, one digit, and one "
            "special character."
        )

    # --- confirm_password ---
    confirm = data.get("confirm_password") or ""
    if password and confirm != password:
        errors.append("Passwords do not match.")

    # --- optional: terms acceptance ---
    if not data.get("accept_terms"):
        errors.append("You must accept the terms and conditions.")

    return errors


def rate_limit_check(ip: str) -> bool:
    """
    Naïve in-process rate limiter (replace with Redis in production).
    Returns True if the request is allowed.
    """
    # In production use Flask-Limiter or a Redis-backed counter.
    return True  # placeholder


# ---------------------------------------------------------------------------
# Registration route
# ---------------------------------------------------------------------------
@app.route("/api/register", methods=["POST"])
def register():
    # ---- 1. Content-type guard -------------------------------------------
    if not request.is_json:
        return jsonify({"success": False, "message": "Content-Type must be application/json."}), 415

    # ---- 2. Rate limiting ---------------------------------------------------
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if not rate_limit_check(client_ip):
        return jsonify({"success": False, "message": "Too many requests. Please try again later."}), 429

    # ---- 3. Parse body ------------------------------------------------------
    try:
        data = request.get_json(force=False, silent=True)
    except Exception:
        data = None

    if not isinstance(data, dict):
        return jsonify({"success": False, "message": "Invalid JSON payload."}), 400

    # ---- 4. Validate --------------------------------------------------------
    errors = validate_registration_data(data)
    if errors:
        return jsonify({"success": False, "errors": errors}), 422

    username = data["username"].strip()
    email    = data["email"].strip().lower()
    password = data["password"]

    # ---- 5. Uniqueness check (timing-safe via HMAC lookup) ------------------
    email_hmac = _hmac_email(email)

    existing_username = User.query.filter_by(username=username).first()
    if existing_username:
        return jsonify({"success": False, "message": "Username is already taken."}), 409

    existing_email = User.query.filter_by(email_hmac=email_hmac).first()
    if existing_email:
        # Don't reveal whether the email is registered (account enumeration)
        return jsonify({
            "success": False,
            "message": "If this email is not already registered, you will receive a confirmation link shortly.",
        }),