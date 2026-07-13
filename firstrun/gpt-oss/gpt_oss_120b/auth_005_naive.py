import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt

# -------------------- Configuration --------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super-secret-key")
app.config["JWT_SECRET"] = os.getenv("JWT_SECRET_KEY", "jwt-super-secret")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Lockout policy
MAX_FAILED_ATTEMPTS = 5          # attempts before lock
LOCKOUT_DURATION = timedelta(minutes=15)  # lock duration

db = SQLAlchemy(app)


# -------------------- Database Model --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)

    failed_attempts = db.Column(db.Integer, default=0, nullable=False)
    lock_until = db.Column(db.DateTime, nullable=True)  # null means not locked

    def is_locked(self):
        if self.lock_until:
            if datetime.utcnow() < self.lock_until:
                return True
            else:  # lock period expired
                self.failed_attempts = 0
                self.lock_until = None
                db.session.commit()
                return False
        return False


# -------------------- Helper Functions --------------------
def generate_jwt(user_id):
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=2)
    }
    token = jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")
    return token


def hash_password(plain_pw: str) -> bytes:
    return bcrypt.hashpw(plain_pw.encode("utf-8"), bcrypt.gensalt())


def verify_password(stored_hash: bytes, plain_pw: str) -> bool:
    return bcrypt.checkpw(plain_pw.encode("utf-8"), stored_hash)


# -------------------- Routes --------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "User already exists"}), 409

    user = User(
        username=username,
        password_hash=hash_password(password)
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "User registered successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        # Do not reveal that the user does not exist
        return jsonify({"msg": "Invalid credentials"}), 401

    if user.is_locked():
        remaining = (user.lock_until - datetime.utcnow()).seconds // 60 + 1
        return (
            jsonify(
                {
                    "msg": f"Account locked. Try again in {remaining} minute(s)."
                }
            ),
            403,
        )

    if verify_password(user.password_hash, password):
        # Successful login: reset counters and issue token
        user.failed_attempts = 0
        user.lock_until = None
        db.session.commit()
        token = generate_jwt(user.id)
        return jsonify({"token": token}), 200
    else:
        # Failed attempt handling
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.lock_until = datetime.utcnow() + LOCKOUT_DURATION
            db.session.commit()
            return (
                jsonify(
                    {
                        "msg": f"Too many failed attempts. Account locked for {LOCKOUT_DURATION.total_seconds() // 60} minutes."
                    }
                ),
                403,
            )
        else:
            db.session.commit()
            remaining = MAX_FAILED_ATTEMPTS - user.failed_attempts
            return (
                jsonify(
                    {
                        "msg": f"Invalid credentials. {remaining} attempt(s) left before lockout."
                    }
                ),
                401,
            )


# -------------------- Initialization --------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)