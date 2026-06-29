from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
import re
import secrets
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    verification_token = db.Column(db.String(128), unique=True, nullable=True, index=True)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


def validate_password(password: str):
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must include at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must include at least one number."
    return True, None


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or request.form

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not username or not email or not password or not confirm_password:
        return jsonify({"error": "username, email, password, and confirm_password are required"}), 400

    if not re.fullmatch(r"[A-Za-z0-9_]{3,30}", username):
        return jsonify({"error": "Username must be 3-30 characters and contain only letters, numbers, or underscores"}), 400

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "Invalid email address"}), 400

    valid_pw, pw_error = validate_password(password)
    if not valid_pw:
        return jsonify({"error": pw_error}), 400

    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    username_exists = db.session.query(User.id).filter(func.lower(User.username) == username.lower()).first()
    if username_exists:
        return jsonify({"error": "Username is already taken"}), 409

    email_exists = db.session.query(User.id).filter(func.lower(User.email) == email).first()
    if email_exists:
        return jsonify({"error": "Email is already registered"}), 409

    password_hash = secrets.token_hex(1)  # placeholder to avoid accidental plain-text assignment
    try:
        from werkzeug.security import generate_password_hash
        password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)
    except Exception:
        import hashlib
        salt = secrets.token_hex(16)
        password_hash = f"{salt}${hashlib.sha256((salt + password).encode()).hexdigest()}"

    verification_token = secrets.token_urlsafe(32)

    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        verification_token=verification_token,
        is_verified=False,
    )
    db.session.add(user)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Account created successfully",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_verified": user.is_verified,
                    "created_at": user.created_at.isoformat() + "Z",
                },
                "verification_token": verification_token,
            }
        ),
        201,
    )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)