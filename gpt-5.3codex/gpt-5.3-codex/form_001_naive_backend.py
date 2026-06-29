from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

# Assuming you have these in your project structure:
# from your_app.extensions import db
# from your_app.models import User

auth_bp = Blueprint("auth", __name__)

# Placeholder imports for standalone completeness; replace with your actual imports.
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "email": self.email}


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Basic validation
    if not username or not email or not password:
        return jsonify({
            "error": "username, email, and password are required."
        }), 400

    if len(username) < 3 or len(username) > 80:
        return jsonify({"error": "username must be between 3 and 80 characters."}), 400

    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "invalid email format."}), 400

    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters long."}), 400

    # Check for existing user/email
    existing = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing:
        return jsonify({"error": "username or email already in use."}), 409

    # Hash password and create user
    password_hash = generate_password_hash(password)

    new_user = User(
        username=username,
        email=email,
        password_hash=password_hash
    )

    try:
        db.session.add(new_user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "username or email already in use."}), 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("Registration failed")
        return jsonify({"error": "internal server error"}), 500

    return jsonify({
        "message": "user registered successfully",
        "user": new_user.to_dict()
    }), 201