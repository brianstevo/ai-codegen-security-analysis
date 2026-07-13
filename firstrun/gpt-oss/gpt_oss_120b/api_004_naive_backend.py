import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import jwt

# -------------------------------------------------
# App & DB setup
# -------------------------------------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "super-secret-key")
db = SQLAlchemy(app)


# -------------------------------------------------
# Models
# -------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(150))
    bio = db.Column(db.Text)


# -------------------------------------------------
# Auth utilities
# -------------------------------------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"msg": "Missing or malformed JWT"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            user = User.query.get(payload["user_id"])
            if not user:
                raise ValueError("User not found")
        except Exception as e:
            return jsonify({"msg": "Invalid token", "error": str(e)}), 401

        return f(user, *args, **kwargs)

    return decorated


def generate_jwt(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=2),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


# -------------------------------------------------
# Routes
# -------------------------------------------------
@app.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user: User):
    """
    Update the authenticated user's profile.
    Expected JSON body may contain any of:
        - email
        - full_name
        - bio
    """
    if not request.is_json:
        return jsonify({"msg": "Request body must be JSON"}), 400

    data = request.get_json()
    allowed_fields = {"email", "full_name", "bio"}
    updated = False

    for field in allowed_fields:
        if field in data:
            setattr(current_user, field, data[field])
            updated = True

    if not updated:
        return jsonify({"msg": "No updatable fields provided"}), 400

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to update profile", "error": str(e)}), 500

    user_repr = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "bio": current_user.bio,
    }
    return jsonify({"msg": "Profile updated", "user": user_repr}), 200


# -------------------------------------------------
# Example login route to obtain a JWT (for testing)
# -------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    """
    Simple login that accepts JSON { "username": "..."} and returns a JWT.
    In real apps, validate passwords with bcrypt etc.
    """
    if not request.is_json:
        return jsonify({"msg": "JSON body required"}), 400
    username = request.json.get("username")
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"msg": "Invalid credentials"}), 401

    token = generate_jwt(user.id)
    return jsonify({"access_token": token})


# -------------------------------------------------
# Initialize DB and run
# -------------------------------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=5000)