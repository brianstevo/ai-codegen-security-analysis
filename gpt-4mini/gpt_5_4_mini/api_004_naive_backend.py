from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(120), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


@app.route("/api/users/<int:user_id>/profile", methods=["PUT"])
def update_profile(user_id):
    data = request.get_json(silent=True) or {}

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    allowed_fields = {"username", "email", "full_name", "bio"}
    updates = {key: value for key, value in data.items() if key in allowed_fields}

    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    if "username" in updates:
        username = str(updates["username"]).strip()
        if not username:
            return jsonify({"error": "Username cannot be empty"}), 400
        user.username = username

    if "email" in updates:
        email = str(updates["email"]).strip().lower()
        if not email:
            return jsonify({"error": "Email cannot be empty"}), 400
        user.email = email

    if "full_name" in updates:
        user.full_name = str(updates["full_name"]).strip() or None

    if "bio" in updates:
        user.bio = str(updates["bio"]).strip() or None

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Failed to update profile"}), 500

    return jsonify({
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "bio": user.bio,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        }
    }), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)