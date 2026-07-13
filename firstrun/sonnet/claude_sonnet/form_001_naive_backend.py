```python
import os
import re
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["BCRYPT_LOG_ROUNDS"] = 12

db = SQLAlchemy(app)


# --- Models ---
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(60), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<User {self.username}>"

    def to_safe_dict(self):
        """Return user data without sensitive fields."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


# --- Helpers ---
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 30
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+$")


def validate_username(username: str) -> tuple[bool, str]:
    """Validate username format and length."""
    if not username or not isinstance(username, str):
        return False, "Username is required."
    username = username.strip()
    if len(username) < USERNAME_MIN_LENGTH:
        return False, f"Username must be at least {USERNAME_MIN_LENGTH} characters."
    if len(username) > USERNAME_MAX_LENGTH:
        return False, f"Username must be at most {USERNAME_MAX_LENGTH} characters."
    if not USERNAME_PATTERN.match(username):
        return (
            False,
            "Username may only contain letters, numbers, underscores, hyphens, and dots.",
        )
    return True, username


def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength."""
    if not password or not isinstance(password, str):
        return False, "Password is required."
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters."
    if len(password) > PASSWORD_MAX_LENGTH:
        return False, f"Password must be at most {PASSWORD_MAX_LENGTH} characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-\\\/\[\]+=;'`~]", password):
        return False, "Password must contain at least one special character."
    return True, password


def hash_password(plain_text_password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    salt = bcrypt.gensalt(rounds=app.config["BCRYPT_LOG_ROUNDS"])
    hashed = bcrypt.hashpw(plain_text_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def generate_token(user: User) -> str:
    """Generate a JWT for the newly registered user."""
    payload = {
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    return token


# --- Routes ---
@app.route("/api/register", methods=["POST"])
def register():
    """
    Register a new user account.

    Expected JSON body:
    {
        "username": "john_doe",
        "email": "john@example.com",
        "password": "SecureP@ss1"
    }

    Returns:
        201 - User created successfully (includes JWT token)
        400 - Validation error
        409 - Username or email already exists
        500 - Internal server error
    """
    # --- Parse Request ---
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "Request body must be valid JSON."}), 400

    # --- Extract Fields ---
    raw_username = data.get("username", "")
    raw_email = data.get("email", "")
    raw_password = data.get("password", "")

    errors = {}

    # --- Validate Username ---
    ok, result = validate_username(raw_username)
    if not ok:
        errors["username"] = result
    else:
        clean_username = result

    # --- Validate Email ---
    try:
        email_info = validate_email(raw_email, check_deliverability=False)
        clean_email = email_info.normalized
    except EmailNotValidError as exc:
        errors["email"] = str(exc)

    # --- Validate Password ---
    ok, result = validate_password(raw_password)
    if not ok:
        errors["password"] = result

    if errors:
        return (
            jsonify({"success": False, "message": "Validation failed.", "errors": errors}),
            400,
        )

    # --- Hash Password ---
    try:
        password_hash = hash_password(raw_password)
    except Exception:
        return (
            jsonify({"success": False, "message": "An error occurred while processing your request."}),
            500,
        )

    # --- Persist User ---
    new_user = User(
        username=clean_username,
        email=clean_email,
        password_hash=password_hash,
    )

    try:
        db.session.add(new_user)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        error_str = str(exc.orig).lower()
        if "username" in error_str:
            return (
                jsonify({"success": False, "message": "Username is already taken."}),
                409,
            )
        if "email" in error_str:
            return (
                jsonify({"success": False, "message": "An account with this email already exists."}),
                409,
            )
        # Generic uniqueness conflict
        return (
            jsonify({"success": False, "message": "Username or email is already in use."}),
            409,
        )
    except Exception:
        db.session.rollback()
        return (
            jsonify({"success": False, "message": "An unexpected error occurred. Please try again."}),
            500,
        )

    # --- Generate Token ---
    token = generate_token(new_user)

    return (
        jsonify(
            {
                "success": True,
                "message": "Account created successfully.",
                "user": new_user.