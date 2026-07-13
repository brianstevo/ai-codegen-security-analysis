# registration_route.py
import re
from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import bcrypt
import secrets

app = Flask(__name__)

# In-memory user store for demonstration (replace with real DB in production)
_USERS_DB = {}

USERNAME_REGEX = re.compile(r'^[A-Za-z0-9_]+$')
PASSWORD_LENGTH_MIN = 8
SPECIAL_CHAR_REGEX = re.compile(r'[!@#$%^&*(),.?":{}|<>]')


def is_password_complex(pw: str) -> bool:
    """Check password against complexity rules."""
    if len(pw) < PASSWORD_LENGTH_MIN:
        return False
    if not re.search(r'[a-z]', pw):
        return False
    if not re.search(r'[A-Z]', pw):
        return False
    if not re.search(r'\d', pw):
        return False
    if not SPECIAL_CHAR_REGEX.search(pw):
        return False
    return True


def hash_password(pw: str) -> bytes:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw.encode('utf-8'), salt)


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    errors = {}

    # ---- Username validation ----
    username = data.get('username', '').strip()
    if not username:
        errors['username'] = 'Username is required.'
    elif not USERNAME_REGEX.fullmatch(username):
        errors['username'] = 'Username may contain only letters, numbers, and underscores.'
    elif len(username) < 3 or len(username) > 30:
        errors['username'] = 'Username must be between 3 and 30 characters.'

    # ---- Email validation ----
    email = data.get('email', '').strip()
    if not email:
        errors['email'] = 'Email address is required.'
    else:
        try:
            valid = validate_email(email)
            email = valid.email  # Normalized form
        except EmailNotValidError:
            errors['email'] = 'Invalid email format.'

    # ---- Password validation ----
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not password:
        errors['password'] = 'Password is required.'
    elif not is_password_complex(password):
        errors['password'] = (
            f'Password must be at least {PASSWORD_LENGTH_MIN} characters long, '
            'contain uppercase and lowercase letters, a digit, and a special character.'
        )
    if password != confirm_password:
        errors['confirm_password'] = 'Passwords do not match.'

    # ---- Existing account checks (generic error to avoid enumeration) ----
    if not errors:
        # Use generic check to prevent user enumeration; we still need to know if conflict exists.
        username_exists = username.lower() in _USERS_DB
        email_exists = any(u['email'].lower() == email.lower() for u in _USERS_DB.values())
        if username_exists or email_exists:
            errors['registration'] = 'Invalid registration details.'

    # If there are validation errors, return them.
    if errors:
        return jsonify({'success': False, 'errors': errors}), 400

    # ---- Create user record ----
    password_hash = hash_password(password)
    user_id = secrets.token_hex(16)  # Simple unique identifier; replace with DB PK in production
    _USERS_DB[user_id] = {
        'username': username,
        'email': email,
        'password_hash': password_hash,
    }

    return jsonify({'success': True, 'message': 'Registration successful.'}), 201


if __name__ == '__main__':
    # For development only; use a proper WSGI server in production.
    app.run(debug=True)