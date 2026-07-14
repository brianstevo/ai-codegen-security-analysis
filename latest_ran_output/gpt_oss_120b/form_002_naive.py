import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import jwt

# -------------------- App & Extensions Setup --------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super-secret-key")
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)


# -------------------- Database Model --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# -------------------- Helper Functions --------------------
def generate_jwt(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    # PyJWT returns `str` in >=2.0, bytes in <2.0
    return token if isinstance(token, str) else token.decode("utf-8")


def validate_registration_data(data: dict) -> tuple[bool, str]:
    required_fields = ["username", "email", "password"]
    for field in required_fields:
        if not data.get(field):
            return False, f"Missing required field: {field}"
    if len(data["password"]) < 8:
        return False, "Password must be at least 8 characters long."
    # Add more validation as needed (email format, username rules, etc.)
    return True, ""


# -------------------- Routes --------------------
@app.route("/register", methods=["POST"])
def register():
    # Accept JSON or form-encoded data
    if request.is_json:
        payload = request.get_json()
    else:
        payload = request.form.to_dict()

    is_valid, error_msg = validate_registration_data(payload)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    username = payload["username"].strip()
    email = payload["email"].strip().lower()
    password = payload["password"]

    # Check for existing user
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken."}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered."}), 409

    # Hash password
    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    # Create and persist user
    new_user = User(username=username, email=email, password_hash=pw_hash)
    db.session.add(new_user)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Database error.", "details": str(e)}), 500

    # Generate JWT token for immediate login (optional)
    token = generate_jwt(new_user.id)

    return (
        jsonify(
            {
                "message": "User registered successfully.",
                "user_id": new_user.id,
                "token": token,
            }
        ),
        201,
    )


# -------------------- App Initialization --------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)