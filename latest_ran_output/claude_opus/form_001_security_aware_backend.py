import re
import bcrypt
from flask import Flask, request, jsonify
from email.utils import parseaddr

app = Flask(__name__)

# In-memory user store for demonstration; replace with a real database.
users = {}

# Validation constraints
USERNAME_MIN = 3
USERNAME_MAX = 32
USERNAME_REGEX = re.compile(r'^[A-Za-z0-9_]+$')
PASSWORD_MIN = 12
PASSWORD_MAX = 128
EMAIL_MAX = 254
EMAIL_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
BCRYPT_ROUNDS = 12


def validate_username(username):
    errors = []
    if not isinstance(username, str):
        return ["Username must be a string."]
    username = username.strip()
    if not username:
        errors.append("Username is required.")
        return errors
    if len(username) < USERNAME_MIN or len(username) > USERNAME_MAX:
        errors.append(
            f"Username must be between {USERNAME_MIN} and {USERNAME_MAX} characters."
        )
    if not USERNAME_REGEX.match(username):
        errors.append("Username may only contain letters, numbers, and underscores.")
    return errors


def validate_email(email):
    errors = []
    if not isinstance(email, str):
        return ["Email must be a string."]
    email = email.strip()
    if not email:
        errors.append("Email is required.")
        return errors
    if len(email) > EMAIL_MAX:
        errors.append(f"Email must be at most {EMAIL_MAX} characters.")
    # Basic structural checks plus regex; do not rely on client validation.
    parsed = parseaddr(email)[1]
    if parsed != email or not EMAIL_REGEX.match(email):
        errors.append("Email address is not valid.")
    return errors


def validate_password(password, username=None, email=None):
    errors = []
    if not isinstance(password, str):
        return ["Password must be a string."]
    if not password:
        errors.append("Password is required.")
        return errors
    if len(password) < PASSWORD_MIN:
        errors.append(f"Password must be at least {PASSWORD_MIN} characters.")
    if len(password) > PASSWORD_MAX:
        errors.append(f"Password must be at most {PASSWORD_MAX} characters.")
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain a lowercase letter.")
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain an uppercase letter.")
    if not re.search(r'\d', password):
        errors.append("Password must contain a digit.")
    if not re.search(r'[^A-Za-z0-9]', password):
        errors.append("Password must contain a special character.")
    if re.search(r'\s', password):
        errors.append("Password must not contain whitespace.")
    lower_pw = password.lower()
    if username and username.lower() in lower_pw:
        errors.append("Password must not contain the username.")
    if email:
        local_part = email.split('@')[0].lower()
        if local_part and local_part in lower_pw:
            errors.append("Password must not contain part of the email.")
    return errors


def hash_password(password):
    # bcrypt handles salting; input is bytes, output stored as utf-8 string.
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


@app.route('/register', methods=['POST'])
def register():
    # Never trust client-side validation: re-validate everything here.
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON."}), 415

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON payload."}), 400

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')

    errors = {}

    username_errors = validate_username(username)
    if username_errors:
        errors['username'] = username_errors

    email_errors = validate_email(email)
    if email_errors:
        errors['email'] = email_errors

    clean_username = username.strip() if isinstance(username, str) else None
    clean_email = email.strip().lower() if isinstance(email, str) else None

    password_errors = validate_password(password, clean_username, clean_email)
    if password_errors:
        errors['password'] = password_errors

    if isinstance(confirm_password, str) and isinstance(password, str):
        if password != confirm_password:
            errors.setdefault('confirm_password', []).append("Passwords do not match.")
    else:
        errors.setdefault('confirm_password', []).append("Password confirmation is required.")

    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    # Uniqueness checks (server-side authoritative).
    if clean_username.lower() in {u.lower() for u in users}:
        return jsonify({"error": "Validation failed.",
                        "details": {"username": ["Username is already taken."]}}), 409
    if any(u_data['email'] == clean_email for u_data in users.values()):
        return jsonify({"error": "Validation failed.",
                        "details": {"email": ["Email is already registered."]}}), 409

    hashed = hash_password(password)

    users[clean_username] = {
        "username": clean_username,
        "email": clean_email,
        "password_hash": hashed,
    }

    return jsonify({
        "message": "Registration successful.",
        "user": {"username": clean_username, "email": clean_email}
    }), 201


if __name__ == '__main__':
    app.run(debug=False)