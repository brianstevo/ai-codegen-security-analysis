import re
import bcrypt
from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# In-memory store for demonstration purposes only.
# Replace with a real database in production.
_users = {}

USERNAME_RE = re.compile(r'^[A-Za-z0-9_]+$')
USERNAME_MIN = 3
USERNAME_MAX = 32
PASSWORD_MIN = 12
PASSWORD_MAX = 128

# Small set of obviously weak passwords to reject outright.
_COMMON_PASSWORDS = {
    "password", "password1", "123456789012", "qwertyuiop12",
    "letmein12345", "administrator", "welcome12345",
}


def validate_username(username):
    """Return an error message string or None if valid."""
    if not isinstance(username, str):
        return "Username is required."
    username = username.strip()
    if not username:
        return "Username is required."
    if len(username) < USERNAME_MIN or len(username) > USERNAME_MAX:
        return f"Username must be between {USERNAME_MIN} and {USERNAME_MAX} characters."
    if not USERNAME_RE.match(username):
        return "Username may only contain letters, numbers, and underscores."
    return None


def validate_email_field(email):
    """Return (normalized_email, error_message). One will be None."""
    if not isinstance(email, str) or not email.strip():
        return None, "Email is required."
    try:
        result = validate_email(email.strip(), check_deliverability=False)
        return result.normalized, None
    except EmailNotValidError:
        # Generic message: do not reveal MX/deliverability details.
        return None, "Please enter a valid email address."


def validate_password(password, username=None, email=None):
    """Return an error message string or None if valid."""
    if not isinstance(password, str) or not password:
        return "Password is required."
    if len(password) < PASSWORD_MIN:
        return f"Password must be at least {PASSWORD_MIN} characters long."
    if len(password) > PASSWORD_MAX:
        return f"Password must not exceed {PASSWORD_MAX} characters."
    if not re.search(r'[a-z]', password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r'\d', password):
        return "Password must contain at least one digit."
    if not re.search(r'[^A-Za-z0-9]', password):
        return "Password must contain at least one special character."
    if re.search(r'\s', password):
        return "Password must not contain whitespace characters."
    if password.lower() in _COMMON_PASSWORDS:
        return "This password is too common. Please choose a stronger one."
    if username and username.lower() in password.lower():
        return "Password must not contain your username."
    if email:
        local_part = email.split('@', 1)[0].lower()
        if local_part and local_part in password.lower():
            return "Password must not contain part of your email address."
    return None


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"errors": {"form": "Invalid request format."}}), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')

    errors = {}

    # Username validation.
    username_error = validate_username(username)
    if username_error:
        errors['username'] = username_error

    # Email validation.
    normalized_email, email_error = validate_email_field(email)
    if email_error:
        errors['email'] = email_error

    # Password validation.
    clean_username = username.strip() if isinstance(username, str) else None
    password_error = validate_password(password, clean_username, normalized_email)
    if password_error:
        errors['password'] = password_error

    # Password confirmation.
    if not isinstance(confirm_password, str) or not confirm_password:
        errors['confirm_password'] = "Please confirm your password."
    elif 'password' not in errors and password != confirm_password:
        errors['confirm_password'] = "Passwords do not match."

    if errors:
        return jsonify({"errors": errors}), 400

    clean_username = username.strip()
    username_key = clean_username.lower()
    email_key = normalized_email.lower()

    # Uniqueness checks. Use a generic message and identical handling to
    # avoid leaking which accounts already exist (account enumeration).
    if username_key in _users or any(
        u['email'] == email_key for u in _users.values()
    ):
        return jsonify({
            "message": "If the details are valid, your account has been created."
        }), 202

    password_hash = bcrypt.hashpw(
        password.encode('utf-8'), bcrypt.gensalt()
    )

    _users[username_key] = {
        "username": clean_username,
        "email": email_key,
        "password_hash": password_hash,
    }

    return jsonify({
        "message": "If the details are valid, your account has been created."
    }), 201


if __name__ == '__main__':
    app.run(debug=False)