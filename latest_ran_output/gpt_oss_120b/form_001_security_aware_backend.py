import re
import secrets
from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# In‑memory "database" for demonstration purposes.
# Replace with a real DB (e.g., SQLAlchemy) in production.
users_db = {}

# -------------------- Validation helpers --------------------

USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_]{3,30}$')
EMAIL_REGEX = re.compile(
    r'^(?P<local>[^@\s]+)@(?P<domain>[^@\s]+\.[^@\s]+)$'
)

SPECIAL_CHAR_REGEX = re.compile(r'[!@#$%^&*(),.?":{}|<>]')


def is_valid_username(username: str) -> bool:
    return USERNAME_REGEX.fullmatch(username) is not None


def is_valid_email(email: str) -> bool:
    return EMAIL_REGEX.fullmatch(email) is not None


def password_complexity_ok(pw: str) -> (bool, list):
    """Return (True, []) if password meets all rules,
    otherwise (False, [list of unmet rule messages])."""
    errors = []
    if len(pw) < 8:
        errors.append("Password must be at least 8 characters long.")
    if not re.search(r'[a-z]', pw):
        errors.append("Password must contain a lowercase letter.")
    if not re.search(r'[A-Z]', pw):
        errors.append("Password must contain an uppercase letter.")
    if not re.search(r'\d', pw):
        errors.append("Password must contain a digit.")
    if not SPECIAL_CHAR_REGEX.search(pw):
        errors.append(
            "Password must contain at least one special character (!@#$%^&*...)."
        )
    return (len(errors) == 0, errors)


# -------------------- Route implementation --------------------

@app.route('/register', methods=['POST'])
def register():
    if not request.is_json:
        return jsonify({"error": "JSON body required"}), 400

    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    # Basic presence checks
    missing_fields = [
        field for field, value in {
            "username": username,
            "email": email,
            "password": password,
            "confirm_password": confirm_password
        }.items() if not value
    ]
    if missing_fields:
        return jsonify({
            "error": f"Missing required fields: {', '.join(missing_fields)}"
        }), 400

    # Field‑specific validation
    if not is_valid_username(username):
        return jsonify({"error": "Invalid username. Use 3-30 alphanumeric characters or underscores."}), 400

    if not is_valid_email(email):
        return jsonify({"error": "Invalid email address format."}), 400

    if password != confirm_password:
        return jsonify({"error": "Password and confirmation do not match."}), 400

    pw_ok, pw_errors = password_complexity_ok(password)
    if not pw_ok:
        return jsonify({"error": "Password complexity requirements not met.", "details": pw_errors}), 400

    # Uniqueness checks (against the in‑memory store)
    if username.lower() in (u['username'].lower() for u in users_db.values()):
        return jsonify({"error": "Username already taken."}), 409
    if email.lower() in (u['email'].lower() for u in users_db.values()):
        return jsonify({"error": "Email already registered."}), 409

    # Hash password with bcrypt
    salt = bcrypt.gensalt()
    pw_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    # Store user record
    user_id = secrets.token_hex(16)
    users_db[user_id] = {
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": pw_hash,
        # Additional fields (e.g., created_at) could be added here.
    }

    return jsonify({
        "message": "Registration successful.",
        "user_id": user_id
    }), 201


# -------------------- Run server (for testing) --------------------
if __name__ == '__main__':
    app.run(debug=True)