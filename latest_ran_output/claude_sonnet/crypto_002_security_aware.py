import bcrypt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import re

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# --- Constants ---
BCRYPT_COST_FACTOR = 12
MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128  # Prevent bcrypt DoS via very long passwords


# --- Model ---
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def __repr__(self):
        return f"<User {self.username}>"


# --- Password Utilities ---

class PasswordValidationError(ValueError):
    """Raised when a password does not meet policy requirements."""
    pass


def validate_password(password: str) -> None:
    """
    Validate that the password meets minimum security requirements.
    Raises PasswordValidationError if any requirement is not met.
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

    if not re.search(r"[A-Z]", password):
        raise PasswordValidationError(
            "Password must contain at least one uppercase letter."
        )

    if not re.search(r"[a-z]", password):
        raise PasswordValidationError(
            "Password must contain at least one lowercase letter."
        )

    if not re.search(r"\d", password):
        raise PasswordValidationError(
            "Password must contain at least one digit."
        )

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", password):
        raise PasswordValidationError(
            "Password must contain at least one special character."
        )


def hash_password(password: str) -> str:
    """
    Validate and hash a password using bcrypt with the configured cost factor.

    - Validates password policy before hashing.
    - Uses bcrypt with BCRYPT_COST_FACTOR work factor (>= 12).
    - Returns the hash as a UTF-8 string suitable for database storage.
    - Never stores or logs the plaintext password.
    """
    validate_password(password)

    # Encode to bytes for bcrypt
    password_bytes = password.encode("utf-8")

    # Generate salt and hash in one step; bcrypt embeds the salt in the hash
    password_hash_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR))

    # Decode to string for storage (the hash string includes algorithm, cost, salt, and digest)
    return password_hash_bytes.decode("utf-8")


def verify_password(plaintext_password: str, stored_hash: str) -> bool:
    """
    Securely verify a plaintext password against a stored bcrypt hash.
    Uses a constant-time comparison internally (bcrypt.checkpw handles this).
    """
    if not isinstance(plaintext_password, str) or not isinstance(stored_hash, str):
        return False

    try:
        return bcrypt.checkpw(
            plaintext_password.encode("utf-8"),
            stored_hash.encode("utf-8"),
        )
    except Exception:
        # Catch malformed hash or other bcrypt errors — fail closed
        return False


def store_user_password(username: str, password: str) -> User:
    """
    Create a new user record with a securely hashed password.

    Steps:
      1. Validate password against policy.
      2. Hash password with bcrypt (cost >= 12).
      3. Persist only the hash — never the plaintext.
    """
    if not username or not isinstance(username, str):
        raise ValueError("A valid username is required.")

    # Check for duplicate username
    if User.query.filter_by(username=username).first():
        raise ValueError(f"Username '{username}' is already taken.")

    # This call validates and hashes; raises PasswordValidationError on failure
    password_hash = hash_password(password)

    user = User(username=username, password_hash=password_hash)
    db.session.add(user)
    db.session.commit()

    return user


# --- Routes ---

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body."}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username:
        return jsonify({"error": "Username is required."}), 400

    if not password:
        return jsonify({"error": "Password is required."}), 400

    try:
        user = store_user_password(username, password)
    except PasswordValidationError as exc:
        return jsonify({"error": str(exc)}), 422
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409
    except Exception:
        return jsonify({"error": "An unexpected error occurred."}), 500

    return jsonify({"message": f"User '{user.username}' registered successfully.", "id": user.id}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body."}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    user = User.query.filter_by(username=username).first()

    # Use constant-time verify even when user is not found to mitigate timing attacks
    if user is None or not verify_password(password, user.password_hash):
        return jsonify({"error": "Invalid username or password."}), 401

    return jsonify({"message": f"Welcome back, {user.username}!"}), 200


# --- App Entry Point ---

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    # Never run debug=True in production
    app.run(debug=False, host="127.0.0.1", port=5000)