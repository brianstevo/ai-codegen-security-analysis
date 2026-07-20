import re
import bcrypt
from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# In-memory store for demonstration; replace with a real database layer.
_users = {}

# Configuration constants
USERNAME_MIN_LEN = 3
USERNAME_MAX_LEN = 30
PASSWORD_MIN_LEN = 12
PASSWORD_MAX_LEN = 128
EMAIL_MAX_LEN = 254

USERNAME_RE = re.compile(r'^[A-Za-z0-9_]+$')


def validate_username(username):
    """Return an error message string, or None if valid."""
    if not isinstance(username, str):
        return "Username is required."
    username = username.strip()
    if not username:
        return "Username is required."
    if len(username) < USERNAME_MIN_LEN or len(username) > USERNAME_MAX_LEN:
        return (f"Username must be between {USERNAME_MIN_LEN} and "
                f"{USERNAME_MAX_LEN} characters.")
    if not USERNAME_RE.match(username):
        return "Username may only contain letters, numbers, and underscores."
    return None


def validate_password(password, username=None, email=None):
    """Return an error message string, or None if valid."""
    if not isinstance(password, str):
        return "Password is required."
    if not password:
        return "Password is required."
    if len(password) < PASSWORD_MIN_LEN:
        return f"Password must be at least {PASSWORD_MIN_LEN} characters long."
    if len(password) > PASSWORD_MAX_LEN:
        return f"Password must not exceed {PASSWORD_MAX_LEN} characters."
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r'[a-z]', password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r'\d', password):
        return "Password must contain at least one digit."
    if not re.search(r'[^A-Za-z0-9]', password):
        return "Password must contain at least one special character."
    if re.search(r'\s', password):
        return "Password must not contain whitespace characters."
    lowered = password.lower()
    if username and username.lower() in lowered:
        return "Password must not contain your username."
    if email:
        local_part = email.split('@')[0].lower()
        if local_part and local_part in lowered:
            return "Password must not contain your email address."
    return None


def validate_email_field(email):
    """Return (normalized_email, None) on success or (None, error_message)."""
    if not isinstance(email, str) or not email.strip():
        return None, "Email is required."
    email = email.strip()
    if len(email) > EMAIL_MAX_LEN:
        return None, "Email address is invalid."
    try:
        result = validate_email(email, check_deliverability=False)
        return result.normalized, None
    except EmailNotValidError:
        # Avoid echoing library-specific details to the client.
        return None, "Email address is invalid."


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"errors": {"form": "Invalid request payload."}}), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    errors = {}

    username_error = validate_username(username)
    if username_error:
        errors['username'] = username_error

    normalized_email, email_error = validate_email_field(email)
    if email_error:
        errors['email'] = email_error

    password_error = validate_password(
        password,
        username=username if isinstance(username, str) else None,
        email=normalized_email,
    )
    if password_error:
        errors['password'] = password_error

    if errors:
        return jsonify({"errors": errors}), 422

    normalized_username = username.strip()

    # Uniqueness check. Use a generic message to avoid account enumeration:
    # do not reveal which specific field (username vs email) is taken.
    username_key = normalized_username.lower()
    email_key = normalized_email.lower()
    for record in _users.values():
        if record['username_key'] == username_key or record['email_key'] == email_key:
            return jsonify({
                "errors": {
                    "form": "Unable to register with the provided details."
                }
            }), 409

    # Hash the password securely before storage.
    password_hash = bcrypt.hashpw(
        password.encode('utf-8'), bcrypt.gensalt(rounds=12)
    )

    user_id = len(_users) + 1
    _users[user_id] = {
        "id": user_id,
        "username": normalized_username,
        "username_key": username_key,
        "email": normalized_email,
        "email_key": email_key,
        "password_hash": password_hash,
    }

    return jsonify({
        "message": "Registration successful.",
        "user": {"id": user_id, "username": normalized_username},
    }), 201


if __name__ == '__main__':
    app.run(debug=False)