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
# Model
# ---------------------------------------------------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    full_name = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User {self.username}>"


with app.app_context():
    db.create_all()


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+"
    r"@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
    r"\.[a-zA-Z]{2,}$"
)

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")

PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 128


def validate_full_name(name: str) -> list[str]:
    errors = []
    name = name.strip()
    if not name:
        errors.append("Full name is required.")
    elif len(name) < 2:
        errors.append("Full name must be at least 2 characters.")
    elif len(name) > 128:
        errors.append("Full name must not exceed 128 characters.")
    elif not re.match(r"^[\w\s'\-\.]+$", name, re.UNICODE):
        errors.append("Full name contains invalid characters.")
    return errors


def validate_username(username: str) -> list[str]:
    errors = []
    if not username:
        errors.append("Username is required.")
    elif not USERNAME_RE.match(username):
        errors.append(
            "Username must be 3–32 characters and may only contain "
            "letters, digits, underscores, hyphens, or dots."
        )
    return errors


def validate_email(email: str) -> list[str]:
    errors = []
    email = email.strip().lower()
    if not email:
        errors.append("Email address is required.")
    elif len(email) > 254:
        errors.append("Email address is too long.")
    elif not EMAIL_RE.match(email):
        errors.append("Email address is not valid.")
    return errors


def validate_password(password: str, confirm_password: str) -> list[str]:
    """
    Enforce password complexity rules:
      - Minimum 12 characters
      - Maximum 128 characters (bcrypt silently truncates at 72; we reject long ones)
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one digit
      - At least one special character
      - Passwords must match
    """
    errors = []

    if not password:
        errors.append("Password is required.")
        return errors  # no point continuing

    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")

    if len(password) > PASSWORD_MAX_LENGTH:
        errors.append(f"Password must not exceed {PASSWORD_MAX_LENGTH} characters.")

    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")

    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")

    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")

    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]", password):
        errors.append("Password must contain at least one special character.")

    if password != confirm_password:
        errors.append("Passwords do not match.")

    return errors


def sanitize_string(value: str) -> str:
    """Basic sanitization – strip whitespace and escape HTML entities."""
    return html.escape(value.strip()) if isinstance(value, str) else ""


# ---------------------------------------------------------------------------
# Registration route
# ---------------------------------------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    # -----------------------------------------------------------------------
    # 1. Parse input – always read from the server; never rely on the client
    # -----------------------------------------------------------------------
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "errors": ["Invalid or missing JSON body."]}), 400

    # Raw field extraction (strings only)
    raw_full_name = data.get("full_name", "") if isinstance(data.get("full_name"), str) else ""
    raw_username = data.get("username", "") if isinstance(data.get("username"), str) else ""
    raw_email = data.get("email", "") if isinstance(data.get("email"), str) else ""
    raw_password = data.get("password", "") if isinstance(data.get("password"), str) else ""
    raw_confirm = data.get("confirm_password", "") if isinstance(data.get("confirm_password"), str) else ""

    # -----------------------------------------------------------------------
    # 2. Server-side validation (never trust the client)
    # -----------------------------------------------------------------------
    errors = []
    errors.extend(validate_full_name(raw_full_name))
    errors.extend(validate_username(raw_username))
    errors.extend(validate_email(raw_email))
    errors.extend(validate_password(raw_password, raw_confirm))

    if errors:
        return jsonify({"success": False, "errors": errors}), 422

    # -----------------------------------------------------------------------
    # 3. Sanitize values before storing
    # -----------------------------------------------------------------------
    full_name = sanitize_string(raw_full_name)
    username = sanitize_string(raw_username)
    email = raw_email.strip().lower()  # emails are case-insensitive by convention

    # -----------------------------------------------------------------------
    # 4. Uniqueness checks (authoritative – only the server knows the DB)
    # -----------------------------------------------------------------------
    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"success": False, "errors": ["Username is already taken."]}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "errors": ["An account with that email already exists."]}), 409

    # -----------------------------------------------------------------------
    # 5. Hash password with bcrypt (cost factor 12)
    # -----------------------------------------------------------------------
    password_bytes = raw_password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    password_hash = bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    # -----------------------------------------------------------------------
    # 6. Persist the new user
    # -----------------------------------------------------------------------
    new_user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        full_name=full_name,
    )

    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "errors": ["Registration failed due to a server