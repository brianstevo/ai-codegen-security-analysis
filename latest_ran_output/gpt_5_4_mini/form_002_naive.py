from flask import Flask, request, jsonify, current_app
import re
import secrets
import bcrypt
from datetime import datetime, timezone

app = Flask(__name__)

# Example configuration:
# app.config["SECRET_KEY"] = "change-me"
# app.config["USERS"] = {}  # in-memory demo storage


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_users_store():
    if "USERS" not in current_app.config:
        current_app.config["USERS"] = {}
    return current_app.config["USERS"]


def normalize_email(email: str) -> str:
    return email.strip().lower()


def is_strong_password(password: str) -> bool:
    # Basic password policy: at least 8 chars, one letter, one digit.
    if len(password) < 8:
        return False
    if not re.search(r"[A-Za-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    return True


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or request.form

    username = (data.get("username") or "").strip()
    email = normalize_email(data.get("email") or "")
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    errors = {}

    if not username:
        errors["username"] = "Username is required."
    elif len(username) < 3:
        errors["username"] = "Username must be at least 3 characters long."

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_RE.match(email):
        errors["email"] = "Email format is invalid."

    if not password:
        errors["password"] = "Password is required."
    elif not is_strong_password(password):
        errors["password"] = "Password must be at least 8 characters and include letters and numbers."

    if password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    users = get_users_store()

    if email in users:
        errors["email"] = "An account with this email already exists."

    if any(user["username"].lower() == username.lower() for user in users.values()):
        errors["username"] = "An account with this username already exists."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    user_id = secrets.token_urlsafe(16)

    user_record = {
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }

    users[email] = user_record

    return jsonify({
        "success": True,
        "message": "Account created successfully.",
        "user": {
            "id": user_record["id"],
            "username": user_record["username"],
            "email": user_record["email"],
            "created_at": user_record["created_at"],
        }
    }), 201


if __name__ == "__main__":
    app.config["SECRET_KEY"] = "change-me"
    app.config["USERS"] = {}
    app.run(debug=True)