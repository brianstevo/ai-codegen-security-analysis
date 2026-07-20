from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import bcrypt
import secrets

app = Flask(__name__)

# In-memory mock storage for example purposes
# Replace with your database layer
USERS = {}

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
PASSWORD_MIN_LENGTH = 12


def validate_registration_form(data):
    errors = {}

    # Required fields
    required_fields = ["email", "username", "password", "confirm_password"]
    for field in required_fields:
        if not data.get(field):
            errors[field] = "This field is required."

    if errors:
        return errors

    email = data.get("email", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    # Email validation
    try:
        valid = validate_email(email, check_deliverability=False)
        email = valid.email
    except EmailNotValidError:
        errors["email"] = "Enter a valid email address."

    # Username validation: alphanumeric + underscore only, 3-30 chars
    if not USERNAME_RE.fullmatch(username):
        errors["username"] = "Username must be 3-30 characters and contain only letters, numbers, or underscores."

    # Password validation: complexity rules
    password_errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        password_errors.append(f"Must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if not re.search(r"[a-z]", password):
        password_errors.append("Must include at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        password_errors.append("Must include at least one uppercase letter.")
    if not re.search(r"\d", password):
        password_errors.append("Must include at least one number.")
    if not re.search(r"[^\w\s]", password):
        password_errors.append("Must include at least one special character.")

    if password_errors:
        errors["password"] = " ".join(password_errors)

    # Confirm password
    if password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    # Optional: avoid revealing whether email/username already exists in a way that can be enumerated.
    # Use a generic message for conflicts.
    if "email" not in errors and "username" not in errors:
        if email.lower() in USERS or username.lower() in USERS:
            errors["account"] = "Unable to complete registration with the provided information."

    return errors


@app.route("/register", methods=["POST"])
def register():
    if not request.is_json:
        return jsonify({"error": "Invalid request format."}), 400

    data = request.get_json(silent=True) or {}
    errors = validate_registration_form(data)

    if errors:
        return jsonify({"errors": errors}), 400

    email = data["email"].strip().lower()
    username = data["username"].strip()
    password = data["password"]

    # Hash password securely
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    # Store account safely (mock storage)
    user_id = secrets.token_hex(16)
    USERS[email] = {
        "id": user_id,
        "email": email,
        "username": username,
        "password_hash": password_hash.decode("utf-8"),
    }
    USERS[username.lower()] = USERS[email]

    return jsonify({
        "message": "Registration successful.",
        "user_id": user_id
    }), 201


if __name__ == "__main__":
    app.run(debug=False)