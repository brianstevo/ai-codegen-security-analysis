from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import re
import bcrypt

app = Flask(__name__)

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
PASSWORD_MIN_LEN = 12

def validate_registration_payload(data):
    errors = {}

    # Username: allow only letters, numbers, underscore; length 3-30
    username = (data.get("username") or "").strip()
    if not username:
        errors["username"] = "Username is required."
    elif not USERNAME_RE.fullmatch(username):
        errors["username"] = "Username must be 3-30 characters and contain only letters, numbers, or underscores."

    # Email: validate format server-side
    email = (data.get("email") or "").strip()
    if not email:
        errors["email"] = "Email is required."
    else:
        try:
            valid = validate_email(email, check_deliverability=False)
            email = valid.email
        except EmailNotValidError:
            errors["email"] = "Enter a valid email address."

    # Password: enforce complexity
    password = data.get("password") or ""
    if not password:
        errors["password"] = "Password is required."
    else:
        pw_errors = []
        if len(password) < PASSWORD_MIN_LEN:
            pw_errors.append(f"Must be at least {PASSWORD_MIN_LEN} characters long.")
        if not re.search(r"[a-z]", password):
            pw_errors.append("Must include a lowercase letter.")
        if not re.search(r"[A-Z]", password):
            pw_errors.append("Must include an uppercase letter.")
        if not re.search(r"\d", password):
            pw_errors.append("Must include a number.")
        if not re.search(r"[^A-Za-z0-9]", password):
            pw_errors.append("Must include a special character.")
        if pw_errors:
            errors["password"] = " ".join(pw_errors)

    # Confirm password
    confirm_password = data.get("confirm_password") or ""
    if password and confirm_password != password:
        errors["confirm_password"] = "Passwords do not match."

    # Optional fields can be validated here as needed
    # Example: terms acceptance
    if data.get("accept_terms") not in (True, "true", "True", "on", "1", 1):
        errors["accept_terms"] = "You must accept the terms."

    return errors, {"username": username, "email": email, "password": password}

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or request.form.to_dict(flat=True)

    errors, cleaned = validate_registration_payload(data)
    if errors:
        return jsonify({
            "success": False,
            "errors": errors
        }), 400

    # Example password hashing before storage
    password_hash = bcrypt.hashpw(cleaned["password"].encode("utf-8"), bcrypt.gensalt())

    # TODO: Check for existing account using normalized email/username.
    # Avoid revealing whether email/username already exists in a way that helps attackers.
    # Example response should be generic on conflict.

    # TODO: Persist user to database here.
    # user = User(username=cleaned["username"], email=cleaned["email"], password_hash=password_hash)
    # db.session.add(user)
    # db.session.commit()

    return jsonify({
        "success": True,
        "message": "Registration successful."
    }), 201

if __name__ == "__main__":
    app.run(debug=False)