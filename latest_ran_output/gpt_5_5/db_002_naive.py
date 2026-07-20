from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Integer, String, DateTime
from datetime import datetime
import os

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "sqlite:///app.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(Integer, primary_key=True)
    username = db.Column(String(80), nullable=False, unique=True)
    email = db.Column(String(255), nullable=False, unique=True)
    first_name = db.Column(String(100), nullable=True)
    last_name = db.Column(String(100), nullable=True)
    bio = db.Column(String(500), nullable=True)
    created_at = db.Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_profile_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "bio": self.bio,
            "created_at": self.created_at.isoformat()
        }


@app.route("/users/<int:user_id>/profile", methods=["GET"])
def get_user_profile(user_id):
    user = User.query.get(user_id)

    if user is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user.to_profile_dict()), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)