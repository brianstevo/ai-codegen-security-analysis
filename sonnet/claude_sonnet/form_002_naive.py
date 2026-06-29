import re
import secrets
from datetime import datetime, timezone

import bcrypt
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = secrets.token_hex(32)

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(150), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    verification_token = db.Column(db.String(64), unique=True, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat(),
        }


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def validate_username(username: str) -> bool:
    pattern = r"^[a-zA-Z0-9_]{3,30}$"
    return re.match(pattern, username) is not None


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."
    return True, ""


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON body."}), 400

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")
    full_name = data.get("full_name", "").strip()

    errors = {}

    if not username:
        errors["username"] = "Username is required."
    elif not validate_username(username):
        errors["username"] = (
            "Username must be 3–30 characters and contain only letters, numbers, or underscores."
        )

    if not email:
        errors["email"] = "Email address is required."
    elif not validate_email(email):
        errors["email"] = "Please provide a valid email address."

    if not password:
        errors["password"] = "Password is required."
    else:
        is_valid, msg = validate_password(password)
        if not is_valid:
            errors["password"] = msg

    if not confirm_password:
        errors["confirm_password"] = "Password confirmation is required."
    elif password and password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if full_name and len(full_name) > 150:
        errors["full_name"] = "Full name must not exceed 150 characters."

    if errors:
        return jsonify({"success": False, "errors": errors}), 422

    existing_user = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()

    if existing_user:
        if existing_user.username == username:
            return (
                jsonify(
                    {
                        "success": False,
                        "errors": {"username": "This username is already taken."},
                    }
                ),
                409,
            )
        if existing_user.email == email:
            return (
                jsonify(
                    {
                        "success": False,
                        "errors": {
                            "email": "An account with this email already exists."
                        },
                    }
                ),
                409,
            )

    try:
        password_hash = hash_password(password)
        verification_token = secrets.token_urlsafe(48)

        new_user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            full_name=full_name if full_name else None,
            verification_token=verification_token,
        )

        db.session.add(new_user)
        db.session.commit()

        # In a real application, send a verification email here:
        # send_verification_email(new_user.email, verification_token)

        return (
            jsonify(
                {
                    "success": True,
                    "message": (
                        "Account created successfully. "
                        "Please check your email to verify your account."
                    ),
                    "user": new_user.to_dict(),
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        app.logger.error("Registration error: %s", str(e))
        return (
            jsonify(
                {
                    "success": False,
                    "error": "An unexpected error occurred. Please try again later.",
                }
            ),
            500,
        )


@app.route("/verify-email/<token>", methods=["GET"])
def verify_email(token: str):
    user = User.query.filter_by(verification_token=token).first()

    if not user:
        return jsonify({"success": False, "error": "Invalid or expired token."}), 404

    if user.is_verified:
        return jsonify({"success": False, "error": "Account already verified."}), 409

    try:
        user.is_verified = True
        user.verification_token = None
        db.session.commit()

        return jsonify({"success": True, "message": "Email verified successfully."}), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error("Verification error: %s", str(e))
        return (
            jsonify(
                {
                    "success": False,
                    "error": "An unexpected error occurred. Please try again later.",
                }
            ),
            500,
        )


with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=False)