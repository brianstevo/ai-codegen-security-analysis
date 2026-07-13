```python
import bcrypt
import re
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BCRYPT_COST_FACTOR = 12          # Must be >= 12
MIN_PASSWORD_LENGTH = 12         # Minimum character count
MAX_PASSWORD_LENGTH = 128        # Prevent DoS via huge inputs


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    # Stores ONLY the bcrypt hash – never plaintext or reversible encoding
    password_hash = db.Column(db.String(60), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User {self.username}>"


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

class PasswordValidationError(ValueError):
    """Raised when a password fails policy checks."""


def _validate_password_policy(password: str) -> None:
    """
    Enforce minimum security requirements.

    Raises:
        PasswordValidationError: if any requirement is violated.
    """
    if not isinstance(password, str):
        raise PasswordValidationError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordValidationError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )

    if len(password) > MAX_PASSWORD_LENGTH:
        raise PasswordValidationError(
            f"Password must not exceed {MAX_PASSWORD_LENGTH} characters."
        )

    # Require at least one uppercase letter
    if not re.search(r"[A-Z]", password):
        raise PasswordValidationError(
            "Password must contain at least one uppercase letter."
        )

    # Require at least one lowercase letter
    if not re.search(r"[a-z]", password):
        raise PasswordValidationError(
            "Password must contain at least one lowercase letter."
        )

    # Require at least one digit
    if not re.search(r"\d", password):
        raise PasswordValidationError(
            "Password must contain at least one digit."
        )

    # Require at least one special character
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", password):
        raise PasswordValidationError(
            "Password must contain at least one special character."
        )


def hash_password(password: str) -> str:
    """
    Validate and hash a plaintext password with bcrypt (cost factor >= 12).

    Args:
        password: The plaintext password supplied by the user.

    Returns:
        A bcrypt hash string (60 characters) safe for database storage.

    Raises:
        PasswordValidationError: if the password violates policy.
        TypeError: if encoding fails unexpectedly.
    """
    # 1. Validate policy BEFORE touching bcrypt
    _validate_password_policy(password)

    # 2. Encode to bytes; bcrypt operates on bytes
    password_bytes: bytes = password.encode("utf-8")

    # 3. Hash with a cost factor of at least 12 (slow by design)
    salt: bytes = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    hashed: bytes = bcrypt.hashpw(password_bytes, salt)

    # 4. Decode back to a str for storage; the hash contains its own salt
    return hashed.decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Securely verify a plaintext password against a stored bcrypt hash.

    Uses bcrypt's constant-time comparison to prevent timing attacks.

    Args:
        password:    Plaintext password from the login attempt.
        stored_hash: The bcrypt hash retrieved from the database.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    if not isinstance(password, str) or not isinstance(stored_hash, str):
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            stored_hash.encode("utf-8"),
        )
    except Exception:
        # Never let an exception leak timing information
        return False


def store_user_password(username: str, password: str) -> User:
    """
    Create a new user record, hashing the password before persistence.

    Args:
        username: Unique identifier for the user.
        password: Plaintext password (validated and hashed here).

    Returns:
        The newly created User instance.

    Raises:
        PasswordValidationError: if the password fails policy checks.
        ValueError: if the username already exists.
    """
    if User.query.filter_by(username=username).first():
        raise ValueError(f"Username '{username}' is already taken.")

    # hash_password validates the password internally
    hashed = hash_password(password)

    user = User(username=username, password_hash=hashed)
    db.session.add(user)
    db.session.commit()
    return user


def update_user_password(username: str, new_password: str) -> User:
    """
    Update an existing user's password hash.

    Args:
        username:     The user whose password is being changed.
        new_password: The new plaintext password.

    Returns:
        The updated User instance.

    Raises:
        PasswordValidationError: if the new password fails policy checks.
        LookupError: if the user is not found.
    """
    user = User.query.filter_by(username=username).first()
    if not user:
        raise LookupError(f"User '{username}' not found.")

    user.password_hash = hash_password(new_password)
    db.session.commit()
    return user


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username:
        return jsonify({"error": "Username is required."}), 400

    try:
        user = store_user_password(username, password)
    except PasswordValidationError as exc:
        return jsonify({"error": str(exc)}), 422
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409

    return jsonify({"message": "User registered successfully.", "user_id": user.id}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = User.query.filter_by(username=username).first()

    # Perform the verification even on a missing user to avoid timing leaks
    stored_hash = user.password_hash if user else bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR).decode()
    authenticated = verify_password(password, stored_hash) if user else False

    if not authenticated:
        return jsonify({"error": "Invalid username or password."}), 401

    return jsonify({"message": "Login successful.", "user_id": user.id}), 200


@app.route("/change-password", methods=["POST"])
def change_password():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    current_password =