```python
import re
import secrets
import hashlib
from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import bcrypt
from datetime import datetime, timezone
import logging

# Configure logging (avoid logging sensitive data)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SECRET_KEY"] = secrets.token_hex(32)

# ---------------------------------------------------------------------------
# In-memory "database" – replace with a real DB in production
# ---------------------------------------------------------------------------
users_db: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Constants / policy settings
# ---------------------------------------------------------------------------
USERNAME_MIN_LEN = 3
USERNAME_MAX_LEN = 30
PASSWORD_MIN_LEN = 12
PASSWORD_MAX_LEN = 128

# Allowed characters for usernames: letters, digits, underscores, hyphens
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")

# Common / breached passwords (expand in production; consider using haveibeenpwned API)
COMMON_PASSWORDS = {
    "password123456",
    "123456789012",
    "qwertyuioplkj",
    "letmeinletmein",
    "iloveyouilovey",
    "admin12345678",
    "welcomewelcome",
}

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

class ValidationError(Exception):
    """Raised when one or more validation rules fail."""

    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


def validate_username(username: str) -> str:
    """
    Return a sanitised username or raise ValidationError.
    Rules:
      - Must be a non-empty string.
      - Length between USERNAME_MIN_LEN and USERNAME_MAX_LEN.
      - Only letters, digits, underscores, and hyphens.
      - Must start with a letter or digit (not _ or -).
      - Must not be a reserved word.
    """
    errors: dict[str, str] = {}

    if not isinstance(username, str):
        errors["username"] = "Username must be a string."
        raise ValidationError(errors)

    username = username.strip()

    if not username:
        errors["username"] = "Username is required."
        raise ValidationError(errors)

    if len(username) < USERNAME_MIN_LEN or len(username) > USERNAME_MAX_LEN:
        errors["username"] = (
            f"Username must be between {USERNAME_MIN_LEN} and "
            f"{USERNAME_MAX_LEN} characters."
        )

    if not USERNAME_PATTERN.match(username):
        errors["username"] = (
            "Username may only contain letters, digits, underscores, "
            "and hyphens."
        )

    if username and username[0] in ("-", "_"):
        errors["username"] = "Username must begin with a letter or digit."

    reserved = {"admin", "root", "administrator", "superuser", "system", "support"}
    if username.lower() in reserved:
        # Generic message – don't reveal which names are reserved
        errors["username"] = "That username is not available."

    if errors:
        raise ValidationError(errors)

    return username


def validate_email_address(email: str) -> str:
    """
    Validate and normalise an e-mail address using the email-validator library.
    Returns the normalised address or raises ValidationError.
    """
    errors: dict[str, str] = {}

    if not isinstance(email, str):
        errors["email"] = "Email must be a string."
        raise ValidationError(errors)

    email = email.strip()

    if not email:
        errors["email"] = "Email address is required."
        raise ValidationError(errors)

    if len(email) > 254:  # RFC 5321 limit
        errors["email"] = "Email address is too long."
        raise ValidationError(errors)

    try:
        # check_deliverability=True performs DNS MX look-ups; set False in tests
        valid = validate_email(email, check_deliverability=False)
        return valid.normalized  # type: ignore[attr-defined]
    except EmailNotValidError:
        # Surface a generic message – do NOT echo back why the address failed
        errors["email"] = "Please enter a valid email address."
        raise ValidationError(errors)


def validate_password(password: str, username: str = "", email: str = "") -> None:
    """
    Enforce password complexity rules.
    Raises ValidationError with a dict of field-level messages.
    Rules:
      - Length between PASSWORD_MIN_LEN and PASSWORD_MAX_LEN.
      - At least one uppercase letter.
      - At least one lowercase letter.
      - At least one digit.
      - At least one special character.
      - Must not contain the username or email local-part (case-insensitive).
      - Must not be in the list of common passwords.
    """
    errors: dict[str, str] = {}

    if not isinstance(password, str):
        errors["password"] = "Password must be a string."
        raise ValidationError(errors)

    # Length check (done before other checks to avoid unnecessary work)
    if len(password) < PASSWORD_MIN_LEN:
        errors["password"] = (
            f"Password must be at least {PASSWORD_MIN_LEN} characters long."
        )
    elif len(password) > PASSWORD_MAX_LEN:
        errors["password"] = (
            f"Password must not exceed {PASSWORD_MAX_LEN} characters."
        )

    # Character-class checks
    if not re.search(r"[A-Z]", password):
        errors.setdefault("password", "")
        errors["password"] = (
            "Password must contain at least one uppercase letter."
        )
    if not re.search(r"[a-z]", password):
        errors["password"] = (
            "Password must contain at least one lowercase letter."
        )
    if not re.search(r"\d", password):
        errors["password"] = "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{}|;:',.<>?/`~\"\\]", password):
        errors["password"] = (
            "Password must contain at least one special character."
        )

    # Context-based check (avoid passwords that contain personal info)
    lower_pw = password.lower()
    if username and username.lower() in lower_pw:
        errors["password"] = "Password must not contain your username."
    if email:
        local_part = email.split("@")[0].lower()
        if len(local_part) >= 4 and local_part in lower_pw:
            errors["password"] = "Password must not contain part of your email address."

    # Common / breached password check
    if password.lower() in COMMON_PASSWORDS:
        errors["password"] = "This password is too common. Please choose a stronger one."

    if errors:
        raise ValidationError(errors)


def validate_display_name(display_name: str) -> str:
    """
    Optional display name validation.
    Allows letters, digits, spaces, apostrophes, and hyphens.
    """
    errors: dict[str, str] = {}

    if not isinstance(display_name, str):
        errors["display_name"] = "Display name must be a string."
        raise ValidationError(errors)

    display_name = display_name.strip()

    if not display_name:
        return display_name  # Optional field – empty is acceptable

    if len(display_name) > 60:
        errors["display_name"] = "Display name must not exceed 60 characters."
        raise ValidationError(errors)

    if not re.match(r"^[a-zA-Z0-9 '\-]+$", display_name):
        errors["display_name"] = (
            "Display name may only contain letters, digits, spaces, "
            "apostrophes, and hyphens."
        )
        raise ValidationError(errors)

    return display_name


def email_already_registered(email: str) -> bool:
    """Check whether a normalised email is already in use."""