from flask import Flask, request, jsonify, g
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
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "bio": self.bio,
            "avatar_url": self.avatar_url,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def get_authenticated_user():
    """
    Replace this stub with real authentication logic (JWT/session).
    For demo purposes, it reads `X-User-Id` header.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id or not user_id.isdigit():
        return None
    return User.query.get(int(user_id))


@app.before_request
def load_user():
    g.current_user = get_authenticated_user()


@app.put("/api/profile")
def update_profile():
    if not g.current_user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    allowed_fields = {"first_name", "last_name", "bio", "avatar_url", "username", "email"}
    updates = {k: v for k, v in data.items() if k in allowed_fields}

    if not updates:
        return jsonify({"error": "No valid fields provided for update"}), 400

    # Basic validation
    if "email" in updates:
        email = (updates["email"] or "").strip().lower()
        if not email or "@" not in email:
            return jsonify({"error": "Invalid email"}), 400
        updates["email"] = email

    if "username" in updates:
        username = (updates["username"] or "").strip()
        if not username or len(username) < 3:
            return jsonify({"error": "Username must be at least 3 characters"}), 400
        updates["username"] = username

    if "bio" in updates and updates["bio"] is not None and len(updates["bio"]) > 500:
        return jsonify({"error": "Bio cannot exceed 500 characters"}), 400

    # Uniqueness checks for email/username
    if "email" in updates:
        existing = User.query.filter(User.email == updates["email"], User.id != g.current_user.id).first()
        if existing:
            return jsonify({"error": "Email already in use"}), 409

    if "username" in updates:
        existing = User.query.filter(User.username == updates["username"], User.id != g.current_user.id).first()
        if existing:
            return jsonify({"error": "Username already in use"}), 409

    try:
        for field, value in updates.items():
            setattr(g.current_user, field, value)
        g.current_user.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Profile updated successfully", "user": g.current_user.to_dict()}), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Database error while updating profile"}), 500


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)