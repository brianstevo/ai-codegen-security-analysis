from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
import bcrypt
import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash size
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<User {self.username}>"


@app.before_first_request
def create_tables():
    db.create_all()


def hash_password(plain_password: str) -> bytes:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt)


def verify_password(stored_hash: bytes, candidate: str) -> bool:
    """Verify a password against the stored bcrypt hash."""
    return bcrypt.checkpw(candidate.encode("utf-8"), stored_hash)


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    # Basic validation
    missing_fields = [field for field in ("username", "email", "password") if not data.get(field)]
    if missing_fields:
        return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

    # Hash the password
    try:
        pwd_hash = hash_password(password)
    except Exception as e:
        return jsonify({"error": f"Password hashing failed: {str(e)}"}), 500

    # Create user record
    new_user = User(username=username, email=email, password_hash=pwd_hash)

    try:
        db.session.add(new_user)
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        # Determine which unique constraint failed
        if "username" in str(e.orig):
            return jsonify({"error": "Username already taken"}), 409
        elif "email" in str(e.orig):
            return jsonify({"error": "Email already registered"}), 409
        else:
            return jsonify({"error": "Database integrity error"}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Unexpected server error: {str(e)}"}), 500

    return jsonify(
        {
            "message": "User registered successfully",
            "user_id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
        }
    ), 201


if __name__ == "__main__":
    app.run(debug=True)