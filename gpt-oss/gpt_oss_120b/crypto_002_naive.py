from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
import bcrypt

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash length

    def verify_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash)


def store_user_password(username: str, raw_password: str) -> User:
    """
    Hashes the provided raw password using bcrypt and stores it in the database.
    Returns the created User instance.

    Raises:
        ValueError: If username already exists or inputs are invalid.
    """
    if not username or not raw_password:
        raise ValueError("Username and password must be non‑empty strings.")

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        raise ValueError(f"User '{username}' already exists.")

    # bcrypt automatically generates a salt; the result is bytes.
    hashed_pw = bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt())

    new_user = User(username=username, password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    return new_user


# Initialize database (run once)
if __name__ == "__main__":
    with app.app_context():
        db.create_all()