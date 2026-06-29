```python
import re
import bcrypt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import html

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


# ---------------------------------------------------------------------------
# Database model
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User {self.username}>"


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

# Compiled patterns (compiled once at module load for performance)
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,50}$")
EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
# At least one uppercase, one lowercase, one digit, one special char
PASSWORD_COMPLEXITY_RE = re.compile(
    r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).{12,128}$"
)

COMMON_PASSWORDS = {
    "Password123!",
    "Password1!",
    "Admin1234!",
    "Welcome1!",
    "Qwerty123!",
    "Letmein1!",
    "Monkey123!",
    "Dragon123!",
    "Summer2024!",
    "Winter2024!",
}


def sanitize_string(value: str) -> str:
    """Strip whitespace and escape HTML entities."""
    return html.escape(value.strip()) if isinstance(value, str) else ""


def validate_full_name(name: str) -> list[str]:
    errors = []
    if not name:
        errors.append("Full name is required.")
        return errors
    if len(name) < 2:
        errors.append("Full name must be at least 2 characters long.")
    if len(name) > 100:
        errors.append("Full name must not exceed 100 characters.")
    if not re.match(r"^[a-zA-Z\s'\-]+$", name):
        errors.append(
            "Full name may only contain letters, spaces, hyphens, and apostrophes."
        )
    return errors


def validate_username(username: str) -> list[str]:
    errors = []
    if not username:
        errors.append("Username is required.")
        return errors
    if not USERNAME_RE.match(username):
        errors.append(
            "Username must be 3–50 characters and may only contain "
            "letters, digits, underscores, dots, or hyphens."
        )
    return errors


def validate_email(email: str) -> list[str]:
    errors = []
    if not email:
        errors.append("Email address is required.")
        return errors
    if len(email) > 255:
        errors.append("Email address is too long (max 255 characters).")
    elif not EMAIL_RE.match(email):
        errors.append("Email address is not valid.")
    return errors


def validate_password(password: str, confirm_password: str, username: str, email: str) -> list[str]:
    errors = []

    if not password:
        errors.append("Password is required.")
        return errors

    if not PASSWORD_COMPLEXITY_RE.match(password):
        errors.append(
            "Password must be 12–128 characters and include at least one uppercase "
            "letter, one lowercase letter, one digit, and one special character "
            "(!@#$%^&*()_+-=[]{};\':\"\\|,.<>/?). "
        )

    if password != confirm_password:
        errors.append("Passwords do not match.")

    # Prevent passwords that contain the username or the local part of the email
    lower_pwd = password.lower()
    if username and username.lower() in lower_pwd:
        errors.append("Password must not contain your username.")

    if email:
        email_local = email.split("@")[0].lower()
        if len(email_local) >= 4 and email_local in lower_pwd:
            errors.append("Password must not contain part of your email address.")

    if password in COMMON_PASSWORDS:
        errors.append("Password is too common. Please choose a more unique password.")

    return errors


def validate_registration_payload(data: dict) -> tuple[dict, list[str]]:
    """
    Sanitise and validate all registration fields.
    Returns (sanitised_data, list_of_errors).
    """
    all_errors = []

    # ------------------------------------------------------------------
    # Extract and sanitise raw inputs (never trust client-submitted data)
    # ------------------------------------------------------------------
    full_name = sanitize_string(data.get("full_name", ""))
    username = sanitize_string(data.get("username", "")).lower()
    email = sanitize_string(data.get("email", "")).lower()
    # Passwords are NOT html-escaped (special chars are intentional)
    password = data.get("password", "").strip() if isinstance(data.get("password"), str) else ""
    confirm_password = (
        data.get("confirm_password", "").strip()
        if isinstance(data.get("confirm_password"), str)
        else ""
    )

    # ------------------------------------------------------------------
    # Field-level validation (server-side; ignoring anything the client did)
    # ------------------------------------------------------------------
    all_errors.extend(validate_full_name(full_name))
    all_errors.extend(validate_username(username))
    all_errors.extend(validate_email(email))
    all_errors.extend(validate_password(password, confirm_password, username, email))

    sanitised = {
        "full_name": full_name,
        "username": username,
        "email": email,
        "password": password,  # raw – used for hashing only, never stored
    }

    return sanitised, all_errors


# ---------------------------------------------------------------------------
# Registration route
# ---------------------------------------------------------------------------
@app.route("/api/register", methods=["POST"])
def register():
    # ------------------------------------------------------------------
    # 1. Ensure we received JSON (reject unexpected content types)
    # ------------------------------------------------------------------
    if not request.is_json:
        return jsonify({"success": False, "errors": ["Request must be JSON."]}), 415

    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"success": False, "errors": ["Invalid or empty JSON body."]}), 400

    # ------------------------------------------------------------------
    # 2. Server-side validation (never relying on client-side checks)
    # ------------------------------------------------------------------
    sanitised, errors = validate_registration_payload(data)

    if errors:
        return jsonify({"success": False, "errors": errors}), 422

    # ------------------------------------------------------------------
    # 3. Uniqueness checks (must happen after validation)
    # ------------------------------------------------------------------
    if User.query.filter_by(username=sanitised["username"]).first():
        return jsonify({"success": False, "errors": ["Username is already taken."]}), 409

    if User.query.filter_by(email=sanitised["email"]).first():
        return jsonify(
            {"success": False, "errors": ["An account with that email already exists."]}
        ), 409

    # ------------------------------------------------------------------
    # 4. Hash the password with bcrypt (work factor 12 for strong KDF)
    #    bcrypt.hashpw expects bytes; we encode to UTF