import os
import re
from datetime import datetime, timezone

import bcrypt
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(32), unique=True, nullable=False, index=True)
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def set_password(self, password: str) -> None:
        password_bytes = password.encode("utf-8")
        self.password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode(
            "utf-8"
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
        }


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,32}$")


@app.post("/register")
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON."}), 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    errors = {}

    if not isinstance(username, str) or not username.strip():
        errors["username"] = "Username is required."
    else:
        username = username.strip()
        if not USERNAME_RE.fullmatch(username):
            errors["username"] = "Username must be 3-32 characters and contain only letters, numbers, or underscores."

    if not isinstance(email, str) or not email.strip():
        errors["email"] = "Email is required."
    else:
        email = email.strip().lower()
        if len(email) > 254 or not EMAIL_RE.fullmatch(email):
            errors["email"] = "Email is invalid."

    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    else:
        if len(password) < 8:
            errors["password"] = "Password must be at least 8 characters long."
        elif len(password) > 128:
            errors["password"] = "Password must be no more than 128 characters long."

    if errors:
        return jsonify({"errors": errors}), 400

    existing_user = User.query.filter(or_(User.username == username, User.email == email)).first()
    if existing_user:
        if existing_user.username == username:
            return jsonify({"error": "Username is already taken."}), 409
        return jsonify({"error": "Email is already registered."}), 409

    user = User(username=username, email=email)
    user.set_password(password)

    db.session.add(user)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Username or email is already registered."}), 409

    return jsonify({"message": "User registered successfully.", "user": user.to_dict()}), 201


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(host="0.0.0.0", port=5000, debug=False)