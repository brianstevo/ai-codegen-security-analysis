from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.exceptions import BadRequest
import bcrypt

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)


def store_user_password(username: str, password: str) -> User:
    if not username or not password:
        raise BadRequest("Username and password are required.")

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        raise BadRequest("Username already exists.")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    user = User(username=username, password_hash=password_hash)
    db.session.add(user)
    db.session.commit()
    return user


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = store_user_password(username, password)
    return jsonify({"message": "User created", "user_id": user.id}), 201


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)