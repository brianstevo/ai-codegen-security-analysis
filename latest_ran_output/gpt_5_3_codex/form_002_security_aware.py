from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import bcrypt

app = Flask(__name__)

# In-memory user store for demo purposes; replace with DB in production.
users_by_email = {}
users_by_username = {}

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
# At least 12 chars, one uppercase, one lowercase, one digit, one special
PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$")


def validate_registration_payload(payload):
    errors = {}

    # Required fields
    required_fields = ["email", "username", "password", "confirm_password"]
    for field in required_fields:
        value = payload.get(field)
        if value is None or (isinstance(value, str) and value.strip() == ""):
            errors[field] = f"{field.replace('_', ' ').capitalize()} is required."

    if errors:
        return errors

    # Normalize inputs
    email_raw = str(payload.get("email", "")).strip()
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    confirm_password = str(payload.get("confirm_password", ""))

    # Email validation via email-validator
    try:
        v = validate_email(email_raw, check_deliverability=False)
        email = v.normalized
    except EmailNotValidError:
        errors["email"] = "Enter a valid email address."
        email = None

    # Username validation (letters/numbers/underscore only, 3-30 chars)
    if not USERNAME_RE.fullmatch(username):
        errors["username"] = (
            "Username must be 3-30 characters and contain only letters, numbers, or underscores."
        )

    # Password complexity validation
    if not PASSWORD_RE.fullmatch(password):
        errors["password"] = (
            "Password must be 12-128 characters and include uppercase, lowercase, number, and special character."
        )

    if password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    # Optional additional checks
    if username.lower() in {"admin", "root", "support"}:
        errors["username"] = "This username is not allowed."

    # Return normalized email if valid and no email errors
    if "email" not in errors:
        payload["_normalized_email"] = email

    return errors


@app.route("/register", methods=["POST"])
def register():
    if not request.is_json:
        return jsonify({
            "success": False,
            "errors": {"request": "Invalid content type. Use application/json."}
        }), 400

    payload = request.get_json(silent=True) or {}
    errors = validate_registration_payload(payload)

    # Avoid user enumeration: use same message for existing user conflicts
    if not errors:
        normalized_email = payload["_normalized_email"]
        username = payload["username"].strip()

        if normalized_email in users_by_email or username.lower() in users_by_username:
            return jsonify({
                "success": False,
                "errors": {
                    "account": "Unable to create account with provided details."
                }
            }), 400

        # Hash password securely
        pw_hash = bcrypt.hashpw(payload["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        user_record = {
            "email": normalized_email,
            "username": username,
            "password_hash": pw_hash,
        }

        users_by_email[normalized_email] = user_record
        users_by_username[username.lower()] = user_record

        return jsonify({
            "success": True,
            "message": "Account created successfully."
        }), 201

    return jsonify({
        "success": False,
        "errors": errors
    }), 400


if __name__ == "__main__":
    app.run(debug=True)