import os
import re
import jwt
import bcrypt
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError

app = Flask(__name__)

# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# User Model
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "is_active": self.is_active,
        }


# Validation helpers
def validate_username(username: str) -> tuple[bool, str]:
    if not username or not username.strip():
        return False, "Username is required."
    username = username.strip()
    if len(username) < 3:
        return False, "Username must be at least 3 characters long."
    if len(username) > 50:
        return False, "Username must not exceed 50 characters."
    if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
        return False, "Username may only contain letters, numbers, underscores, hyphens, and dots."
    return True, ""


def validate_email(email: str) -> tuple[bool, str]:
    if not email or not email.strip():
        return False, "Email is required."
    email = email.strip()
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return False, "Invalid email address."
    if len(email) > 120:
        return False, "Email must not exceed 120 characters."
    return True, ""


def validate_password(password: str) -> tuple[bool, str]:
    if not password:
        return False, "Password is required."
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password must not exceed 128 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", password):
        return False, "Password must contain at least one special character."
    return True, ""


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def generate_token(user: User) -> str:
    payload = {
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    return token


# Registration route
@app.route("/api/register", methods=["POST"])
def register():
    # Accept JSON or form data
    if request.is_json:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"success": False, "message": "Invalid JSON payload."}), 400
    else:
        data = request.form.to_dict()

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Validate fields
    errors = {}

    valid, msg = validate_username(username)
    if not valid:
        errors["username"] = msg

    valid, msg = validate_email(email)
    if not valid:
        errors["email"] = msg

    valid, msg = validate_password(password)
    if not valid:
        errors["password"] = msg

    if errors:
        return (
            jsonify({"success": False, "message": "Validation failed.", "errors": errors}),
            422,
        )

    # Check for existing username / email before hashing (fast fail)
    existing_user = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()

    if existing_user:
        if existing_user.username == username:
            return (
                jsonify({"success": False, "message": "Username is already taken."}),
                409,
            )
        return (
            jsonify({"success": False, "message": "Email address is already registered."}),
            409,
        )

    # Hash password and persist user
    try:
        password_hash = hash_password(password)

        new_user = User(
            username=username,
            email=email,
            password_hash=password_hash,
        )

        db.session.add(new_user)
        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        return (
            jsonify(
                {
                    "success": False,
                    "message": "An account with that username or email already exists.",
                }
            ),
            409,
        )
    except Exception as exc:
        db.session.rollback()
        app.logger.error("Registration error: %s", exc)
        return (
            jsonify({"success": False, "message": "An internal error occurred. Please try again."}),
            500,
        )

    # Generate JWT for immediate login after registration
    token = generate_token(new_user)

    return (
        jsonify(
            {
                "success": True,
                "message": "Account created successfully.",
                "token": token,
                "user": new_user.to_dict(),
            }
        ),
        201,
    )


# Initialize database tables and run
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=False)