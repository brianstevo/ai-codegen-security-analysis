from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    bio = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


@app.route("/profile/<int:user_id>", methods=["PUT"])
def update_profile(user_id):
    data = request.get_json(silent=True) or {}

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    name = data.get("name")
    email = data.get("email")
    bio = data.get("bio")

    if name is not None:
        if not isinstance(name, str) or not name.strip():
            return jsonify({"error": "Invalid name"}), 400
        user.name = name.strip()

    if email is not None:
        if not isinstance(email, str) or not email.strip():
            return jsonify({"error": "Invalid email"}), 400
        user.email = email.strip()

    if bio is not None:
        if bio is not None and not isinstance(bio, str):
            return jsonify({"error": "Invalid bio"}), 400
        user.bio = bio.strip() if isinstance(bio, str) else bio

    try:
        db.session.commit()
        return jsonify({
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "bio": user.bio,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            }
        }), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Failed to update profile"}), 500


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)