# -*- coding: utf-8 -*-
"""
Flask application exposing a PUT endpoint to update the authenticated user's profile.
Uses:
    - Flask
    - Flask_SQLAlchemy for ORM
    - Flask_JWT_Extended for JWT based authentication
    - bcrypt for password hashing (if password is updated)
"""

import os
from datetime import timedelta

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    jwt_required,
    get_jwt_identity,
    create_access_token,
)
import bcrypt

# --------------------------------------------------------------------------- #
# App & Config
# --------------------------------------------------------------------------- #

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///users.db"
)  # fallback to SQLite for demo
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)

db = SQLAlchemy(app)
jwt = JWTManager(app)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash
    full_name = db.Column(db.String(150))
    bio = db.Column(db.Text)

    def set_password(self, plain_password: str):
        self.password_hash = bcrypt.hashpw(
            plain_password.encode("utf-8"), bcrypt.gensalt()
        )

    def check_password(self, plain_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode("utf-8"), self.password_hash)

    def to_dict(self):
        """Serialize user without exposing password hash."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "bio": self.bio,
        }


# --------------------------------------------------------------------------- #
# Helper Functions
# --------------------------------------------------------------------------- #

def get_user_by_identity(identity):
    """Identity can be either user ID (int) or username (str)."""
    if isinstance(identity, int):
        return User.query.get(identity)
    return User.query.filter_by(username=identity).first()


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #

@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    Simple login endpoint to obtain a JWT.
    Expected JSON: {"username": "...", "password": "..."}
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity=user.id)
        return jsonify(access_token=access_token, user=user.to_dict()), 200
    else:
        return jsonify({"msg": "Bad credentials"}), 401


@app.route("/api/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """
    Update the authenticated user's profile.
    Accepts JSON body with any of the following optional fields:
        - username (must be unique)
        - email (must be unique and valid format)
        - password (plain text, will be hashed)
        - full_name
        - bio
    Returns updated user data (excluding password hash).
    """
    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)

    payload = request.get_json(silent=True) or {}

    # ------------------------------------------------------------------- #
    # Validation helpers
    # ------------------------------------------------------------------- #

    def is_valid_email(email: str) -> bool:
        import re

        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        return re.match(email_regex, email) is not None

    errors = {}

    # Username update
    new_username = payload.get("username")
    if new_username and new_username != user.username:
        if User.query.filter_by(username=new_username).first():
            errors["username"] = "Username already taken."
        else:
            user.username = new_username.strip()

    # Email update
    new_email = payload.get("email")
    if new_email and new_email != user.email:
        if not is_valid_email(new_email):
            errors["email"] = "Invalid email format."
        elif User.query.filter_by(email=new_email).first():
            errors["email"] = "Email already in use."
        else:
            user.email = new_email.strip().lower()

    # Password update
    new_password = payload.get("password")
    if new_password:
        if len(new_password) < 8:
            errors["password"] = "Password must be at least 8 characters."
        else:
            user.set_password(new_password)

    # Full name update
    full_name = payload.get("full_name")
    if full_name is not None:  # allow empty string to clear it
        user.full_name = full_name.strip() or None

    # Bio update
    bio = payload.get("bio")
    if bio is not None:
        user.bio = bio.strip() or None

    if errors:
        return jsonify({"errors": errors}), 400

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"msg": "Database error", "detail": str(exc)}), 500

    return jsonify({"msg": "Profile updated", "user": user.to_dict()}), 200


# --------------------------------------------------------------------------- #
# CLI / Dev Helpers
# --------------------------------------------------------------------------- #

@app.cli.command("init-db")
def init_db():
    """Initialize the database and create a demo user."""
    db.drop_all()
    db.create_all()
    demo = User(
        username="demo_user",
        email="demo@example.com",
        full_name="Demo User",
        bio="Just a demo account.",
    )
    demo.set_password("Password123")
    db.session.add(demo)
    db.session.commit()
    print("Database initialized with demo user (username: demo_user, password: Password123)")


# --------------------------------------------------------------------------- #
# Run
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    # Ensure tables exist before first request
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)