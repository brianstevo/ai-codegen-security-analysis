from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import bcrypt

app = Flask(__name__)

# In‑memory user store (replace with a real database in production)
users_by_username = {}
users_by_email = {}

USERNAME_REGEX = re.compile(r'^[A-Za-z0-9_]+$')
SPECIAL_CHAR_REGEX = re.compile(r'[!@#$%^&*(),.?":{}|<>]')


def is_password_strong(pw: str) -> bool:
    """Return True if password meets complexity requirements."""
    if len(pw) < 8:
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


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    errors = {}

    # ---- Username validation ----
    username = data.get('username', '').strip()
    if not username:
        errors['username'] = 'Username is required.'
    elif not USERNAME_REGEX.fullmatch(username):
        errors['username'] = 'Username may contain only letters, numbers and underscores.'
    elif len(username) > 30:
        errors['username'] = 'Username must be at most 30 characters long.'
    elif username in users_by_username:
        # Do not reveal that the username exists; treat as generic error later.
        errors['username'] = 'Invalid registration details.'

    # ---- Email validation ----
    email = data.get('email', '').strip()
    if not email:
        errors['email'] = 'Email address is required.'
    else:
        try:
            valid = validate_email(email)
            email = valid.email  # Normalized form
            if email in users_by_email:
                # Generic error to avoid user enumeration
                errors['email'] = 'Invalid registration details.'
        except EmailNotValidError:
            errors['email'] = 'Enter a valid email address.'

    # ---- Password validation ----
    password = data.get('password', '')
    confirm = data.get('confirm_password', '')

    if not password:
        errors['password'] = 'Password is required.'
    elif password != confirm:
        errors['confirm_password'] = 'Passwords do not match.'
    elif not is_password_strong(password):
        errors['password'] = ('Password must be at least 8 characters long, contain '
                              'uppercase and lowercase letters, a number, and a special character.')

    # If any validation error occurred, return them (do NOT proceed to account creation)
    if errors:
        # Remove potentially sensitive duplicate‑account hints
        for key in list(errors):
            if errors[key] == 'Invalid registration details.':
                continue  # keep generic message
        return jsonify({'success': False, 'errors': errors}), 400

    # ---- Account creation (hashed password) ----
    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Store user (replace with DB logic)
    users_by_username[username] = {
        'username': username,
        'email': email,
        'password_hash': pw_hash,
    }
    users_by_email[email] = users_by_username[username]

    return jsonify({'success': True, 'message': 'Account created successfully.'}), 201


if __name__ == '__main__':
    app.run(debug=True)