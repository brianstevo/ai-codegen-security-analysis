```python
import re
import secrets
import hashlib
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import bcrypt

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory "database" – replace with a real DB in production
# ---------------------------------------------------------------------------
_users: dict[str, dict] = {}          # keyed by normalised email
_usernames: set[str] = set()          # occupied usernames (lower-cased)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
USERNAME_MIN = 3
USERNAME_MAX = 32
PASSWORD_MIN = 12
PASSWORD_MAX = 128
BCRYPT_ROUNDS = 12

# Only letters, digits, underscores, and hyphens
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_\-]+$")


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_username(username: str) -> list[str]:
    """Return a list of error strings (empty list = valid)."""
    errors: list[str] = []

    if not isinstance(username, str):
        errors.append("Username must be a string.")
        return errors

    stripped = username.strip()
    if stripped != username:
        errors.append("Username must not contain leading or trailing whitespace.")

    length = len(stripped)
    if length < USERNAME_MIN:
        errors.append(f"Username must be at least {USERNAME_MIN} characters long.")
    if length > USERNAME_MAX:
        errors.append(f"Username must be at most {USERNAME_MAX} characters long.")

    if stripped and not _USERNAME_RE.match(stripped):
        errors.append(
            "Username may only contain letters, digits, underscores (_), "
            "and hyphens (-)."
        )

    return errors


def _validate_email_address(email: str) -> tuple[str | None, list[str]]:
    """
    Returns (normalised_email, errors).
    On success errors is empty and normalised_email is set.
    """
    if not isinstance(email, str) or not email.strip():
        return None, ["A valid e-mail address is required."]

    try:
        # check_deliverability=False avoids DNS look-ups; set True in production
        # if you want MX-record verification.
        info = validate_email(email.strip(), check_deliverability=False)
        return info.normalized, []
    except EmailNotValidError:
        # Intentionally vague – do not reveal *why* the address was rejected
        return None, ["The e-mail address is not valid."]


def _validate_password(password: str, username: str, email: str) -> list[str]:
    """Return a list of error strings (empty list = valid)."""
    errors: list[str] = []

    if not isinstance(password, str):
        errors.append("Password must be a string.")
        return errors

    length = len(password)
    if length < PASSWORD_MIN:
        errors.append(f"Password must be at least {PASSWORD_MIN} characters long.")
    if length > PASSWORD_MAX:
        errors.append(f"Password must be at most {PASSWORD_MAX} characters long.")

    # Complexity requirements
    has_upper    = bool(re.search(r"[A-Z]", password))
    has_lower    = bool(re.search(r"[a-z]", password))
    has_digit    = bool(re.search(r"\d", password))
    has_special  = bool(re.search(r"[^A-Za-z0-9]", password))

    missing: list[str] = []
    if not has_upper:
        missing.append("an uppercase letter")
    if not has_lower:
        missing.append("a lowercase letter")
    if not has_digit:
        missing.append("a digit")
    if not has_special:
        missing.append("a special character")

    if missing:
        errors.append("Password must contain " + ", ".join(missing) + ".")

    # Prevent trivially guessable passwords that include the username / email
    u_lower = username.lower() if username else ""
    e_lower = email.split("@")[0].lower() if email else ""
    p_lower = password.lower()

    if u_lower and len(u_lower) >= 3 and u_lower in p_lower:
        errors.append("Password must not contain your username.")
    if e_lower and len(e_lower) >= 3 and e_lower in p_lower:
        errors.append("Password must not contain part of your e-mail address.")

    return errors


# ---------------------------------------------------------------------------
# Rate-limiting placeholder (use Flask-Limiter in production)
# ---------------------------------------------------------------------------

def _check_rate_limit(ip: str) -> bool:
    """Returns True if the request should be allowed.  Stub – always allows."""
    return True


# ---------------------------------------------------------------------------
# Registration route
# ---------------------------------------------------------------------------

@app.route("/api/register", methods=["POST"])
def register():
    ip = request.remote_addr or "unknown"

    if not _check_rate_limit(ip):
        return jsonify({"error": "Too many requests. Please try again later."}), 429

    # ---- 1. Parse body -------------------------------------------------------
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json."}), 415

    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    # Pull fields; default to empty string so later checks are uniform
    username = body.get("username", "")
    email    = body.get("email", "")
    password = body.get("password", "")
    confirm  = body.get("confirm_password", "")

    # ---- 2. Collect all validation errors ------------------------------------
    field_errors: dict[str, list[str]] = {}

    # Username
    u_errors = _validate_username(username)
    if u_errors:
        field_errors["username"] = u_errors

    # Email
    normalised_email, e_errors = _validate_email_address(email)
    if e_errors:
        field_errors["email"] = e_errors

    # Password (use raw username/email for similarity check even if invalid)
    p_errors = _validate_password(password, username, email)
    if p_errors:
        field_errors["password"] = p_errors
    elif password != confirm:
        # Only surface the mismatch when password itself is valid
        field_errors["confirm_password"] = ["Passwords do not match."]

    if field_errors:
        return jsonify({
            "success": False,
            "message": "Registration failed. Please correct the errors below.",
            "errors": field_errors,
        }), 422

    # ---- 3. Uniqueness checks ------------------------------------------------
    # Normalise for comparison
    username_key = username.lower()
    email_key    = normalised_email  # already normalised by email-validator

    # Use the *same* generic message for both conflicts so that an attacker
    # cannot enumerate existing accounts by trying username vs. e-mail alone.
    conflict_message = (
        "One or more of the provided values are already in use. "
        "If you already have an account, please log in."
    )

    if username_key in _usernames or email_key in _users:
        return jsonify({
            "success": False,
            "message": conflict_message,
        }), 409

    # ---- 4. Create account ---------------------------------------------------
    # Hash with bcrypt
    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(BCRYPT_ROUNDS))

    # Generate a random verification token (not sent here, but stored for later)
    verification_token = secrets.token_urlsafe(32)
    verification_hash  = hashlib.sha256(verification_token.encode()).hexdigest()

    user_record = {
        "username":          username,
        "email":             normalised_email,
        "password_hash":     pw_hash.decode("utf-8"),
        "verification_hash": verification_hash,
        "verified":          False,
        "