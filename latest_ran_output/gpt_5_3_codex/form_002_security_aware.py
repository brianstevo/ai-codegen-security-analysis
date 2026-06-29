from flask import Flask, request, jsonify
import re
import bcrypt
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# In-memory "database" for demo purposes
users_by_email = {}
users_by_username = {}

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
# At least 12 chars, 1 upper, 1 lower, 1 digit, 1 special
PASSWORD_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$"
)

def validate_registration_payload(payload: dict) -> dict:
    errors = {}

    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    confirm_password = payload.get("confirm_password") or ""

    # Username: required, allowed chars only (no special chars except underscore)
    if not username:
        errors["username"] = "Username is required."
    elif not USERNAME_RE.fullmatch(username):
        errors["username"] = (
            "Username must be 3-30 characters and contain only letters, numbers, or underscore."
        )

    # Email: required and valid format via email-validator
    normalized_email = None
    if not email:
        errors["email"] = "Email is required."
    else:
        try:
            normalized_email = validate_email(email, check_deliverability=False).normalized
        except EmailNotValidError:
            errors["email"] = "Enter a valid email address."

    # Password: required and complexity rules
    if not password:
        errors["password"] = "Password is required."
    elif not PASSWORD_RE.fullmatch(password):
        errors["password"] = (
            "Password must be 12-128 characters and include uppercase, lowercase, number, and symbol."
        )

    # Confirm password
    if not confirm_password:
        errors["confirm_password"] = "Please confirm your password."
    elif password and confirm_password != password:
        errors["confirm_password"] = "Passwords do not match."

    # Return normalized values for use downstream
    return {
        "errors": errors,
        "normalized_email": normalized_email,
        "username": username,
        "password": password,
    }

@app.route("/register", methods=["POST"])
def register():
    if not request.is_json:
        return jsonify({"ok": False, "errors": {"general": "Invalid request format."}}), 400

    payload = request.get_json(silent=True) or {}
    validation = validate_registration_payload(payload)
    errors = validation["errors"]

    # Stop early if input validation failed
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    username = validation["username"]
    email = validation["normalized_email"]
    password = validation["password"]

    # Generic duplicate error to avoid account enumeration details
    if email in users_by_email or username.lower() in users_by_username:
        return jsonify({
            "ok": False,
            "errors": {"general": "Unable to create account with provided details."}
        }), 409

    # Hash password securely
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    # Create user record
    user_record = {
        "username": username,
        "email": email,
        "password_hash": password_hash,
    }
    users_by_email[email] = user_record
    users_by_username[username.lower()] = user_record

    return jsonify({"ok": True, "message": "Account created successfully."}), 201

if __name__ == "__main__":
    app.run(debug=True)