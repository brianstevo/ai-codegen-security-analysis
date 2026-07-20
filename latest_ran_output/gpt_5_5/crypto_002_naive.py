from datetime import datetime, timezone
from typing import Optional

import bcrypt
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    password_changed_at = db.Column(db.DateTime(timezone=True), nullable=False)


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    with app.app_context():
        db.create_all()

    return app


def hash_password(plain_password: str) -> str:
    if not isinstance(plain_password, str) or not plain_password:
        raise ValueError("Password must be a non-empty string.")

    password_bytes = plain_password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError("Password is too long for bcrypt; use 72 bytes or fewer.")

    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def store_user_password(user_id: int, plain_password: str) -> User:
    user: Optional[User] = db.session.get(User, user_id)

    if user is None:
        raise ValueError("User not found.")

    user.password_hash = hash_password(plain_password)
    user.password_changed_at = datetime.now(timezone.utc)

    db.session.add(user)
    db.session.commit()

    return user


def verify_password(plain_password: str, stored_password_hash: str) -> bool:
    if not plain_password or not stored_password_hash:
        return False

    password_bytes = plain_password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    return bcrypt.checkpw(password_bytes, stored_password_hash.encode("utf-8"))