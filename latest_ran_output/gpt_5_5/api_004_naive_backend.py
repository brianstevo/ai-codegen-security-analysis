from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
import re
import os

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "phone": self.phone,
            "bio": self.bio,
            "avatar_url": self.avatar_url,
        }


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.put("/users/<int:user_id>/profile")
def update_user_profile(user_id):
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "User not found"}), 404

    allowed_fields = {
        "first_name",
        "last_name",
        "email",
        "phone",
        "bio",
        "avatar_url",
    }

    updates = {key: value for key, value in data.items() if key in allowed_fields}

    if not updates:
        return jsonify({"error": "No valid profile fields provided"}), 400

    if "email" in updates:
        email = str(updates["email"]).strip().lower()
        if not EMAIL_RE.match(email):
            return jsonify({"error": "Invalid email address"}), 400

        existing_user = User.query.filter(User.email == email, User.id != user.id).first()
        if existing_user:
            return jsonify({"error": "Email is already in use"}), 409

        updates["email"] = email

    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(user, field, value)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Profile update failed due to a database constraint"}), 409
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Profile update failed"}), 500

    return jsonify({"message": "Profile updated successfully", "user": user.to_dict()}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)