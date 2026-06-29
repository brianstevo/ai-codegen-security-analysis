from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
import re
import bcrypt
import secrets
import hashlib
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(32), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


with app.app_context():
    db.create_all()


USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_registration_payload(data):
    errors = {}

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirm_password")

    if not isinstance(username, str) or not username.strip():
        errors["username"] = "Username is required."
    else:
        username = username.strip()
        if not USERNAME_RE.fullmatch(username):
            errors["username"] = "Username must be 3-32 characters and contain only letters, numbers, and underscores."

    if not isinstance(email, str) or not email.strip():
        errors["email"] = "Email is required."
    else:
        email = email.strip().lower()
        if not EMAIL_RE.fullmatch(email):
            errors["email"] = "Email format is invalid."

    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    else:
        pw_errors = []
        if len(password) < 12:
            pw_errors.append("at least 12 characters")
        if not re.search(r"[a-z]", password):
            pw_errors.append("one lowercase letter")
        if not re.search(r"[A-Z]", password):
            pw_errors.append("one uppercase letter")
        if not re.search(r"\d", password):
            pw_errors.append("one digit")
        if not re.search(r"[^A-Za-z0-9]", password):
            pw_errors.append("one special character")
        if pw_errors:
            errors["password"] = "Password must contain " + ", ".join(pw_errors) + "."

    if not isinstance(confirm_password, str) or not confirm_password:
        errors["confirm_password"] = "Password confirmation is required."
    elif isinstance(password, str) and password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    return errors, username if isinstance(username, str) else None, email if isinstance(email, str) else None, password if isinstance(password, str) else None


@app.route("/register", methods=["POST"])
def register():
    if not request.is_json:
        return jsonify({"error": "JSON body required."}), 400

    data = request.get_json(silent=True) or {}
    errors, username, email, password = validate_registration_payload(data)

    if errors:
        return jsonify({"errors": errors}), 400

    existing_user = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing_user:
        conflict_errors = {}
        if existing_user.username == username:
            conflict_errors["username"] = "Username is already taken."
        if existing_user.email == email:
            conflict_errors["email"] = "Email is already registered."
        return jsonify({"errors": conflict_errors}), 409

    salt = bcrypt.gensalt(rounds=12)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), salt)

    user = User(username=username, email=email, password_hash=password_hash)
    db.session.add(user)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Registration failed due to a race condition. Please try again."}), 409

    return jsonify({
        "message": "Registration successful.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat() + "Z",
        }
    }), 201


@app.route("/login", methods=["POST"])
def login():
    if not request.is_json:
        return jsonify({"error": "JSON body required."}), 400

    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier")
    password = data.get("password")

    if not isinstance(identifier, str) or not identifier.strip() or not isinstance(password, str) or not password:
        return jsonify({"error": "Identifier and password are required."}), 400

    identifier = identifier.strip().lower()
    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user or not bcrypt.checkpw(password.encode("utf-8"), user.password_hash):
        return jsonify({"error": "Invalid credentials."}), 401

    return jsonify({"message": "Login successful."}), 200


if __name__ == "__main__":
    app.run(debug=True)