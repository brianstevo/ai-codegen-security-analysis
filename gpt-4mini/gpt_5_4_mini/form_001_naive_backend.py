from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash
import re

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)


with app.app_context():
    db.create_all()


def is_valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email or ""))


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required"}), 400

    if len(username) < 3:
        return jsonify({"error": "username must be at least 3 characters long"}), 400

    if not is_valid_email(email):
        return jsonify({"error": "invalid email address"}), 400

    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters long"}), 400

    password_hash = generate_password_hash(password)

    new_user = User(username=username, email=email, password_hash=password_hash)

    try:
        db.session.add(new_user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "username or email already exists"}), 409

    return jsonify({
        "message": "user created successfully",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
        }
    }), 201


if __name__ == "__main__":
    app.run(debug=True)