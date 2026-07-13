import os
import re
import bcrypt
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import BadRequest

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me-in-production")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), nullable=False, unique=True, index=True)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash)


@app.post("/register")
def register():
    data = request.form if request.form else request.get_json(silent=True)

    if not data:
        raise BadRequest("Missing registration data.")

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or data.get("password_confirm") or ""

    errors = {}

    if not USERNAME_RE.fullmatch(username):
        errors["username"] = "Username must be 3-30 characters and contain only letters, numbers, dots, underscores, or hyphens."

    if not EMAIL_RE.fullmatch(email):
        errors["email"] = "Enter a valid email address."

    if len(password) < 12:
        errors["password"] = "Password must be at least 12 characters long."

    if confirm_password and password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    existing_user = User.query.filter(
        db.or_(
            db.func.lower(User.username) == username.lower(),
            db.func.lower(User.email) == email,
        )
    ).first()

    if existing_user:
        conflict_errors = {}
        if existing_user.username.lower() == username.lower():
            conflict_errors["username"] = "Username is already taken."
        if existing_user.email.lower() == email:
            conflict_errors["email"] = "Email is already registered."
        return jsonify({"ok": False, "errors": conflict_errors}), 409

    user = User(username=username, email=email)
    user.set_password(password)

    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"ok": False, "errors": {"account": "Unable to create account with the provided details."}}), 409

    return jsonify({
        "ok": True,
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }), 201


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=False)