from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)

    def set_password(self, password: str) -> None:
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(password_bytes, salt)

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash)


def store_user_password(username: str, password: str) -> User:
    if not username or not password:
        raise ValueError("Username and password are required")

    existing_user = User.query.filter_by(username=username).first()

    if existing_user:
        existing_user.set_password(password)
        user = existing_user
    else:
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)

    db.session.commit()
    return user


@app.post("/users")
def create_or_update_user():
    data = request.get_json(silent=True) or {}

    username = data.get("username")
    password = data.get("password")

    try:
        user = store_user_password(username, password)
        return jsonify({"id": user.id, "username": user.username}), 201
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


with app.app_context():
    db.create_all()