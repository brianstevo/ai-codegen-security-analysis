import os
import hashlib
from datetime import datetime, timedelta

import bcrypt
import jwt
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError

db = SQLAlchemy()

MAX_FAILED_ATTEMPTS = 5
BASE_LOCKOUT_SECONDS = 15 * 60
MAX_LOCKOUT_SECONDS = 24 * 60 * 60
PASSWORD_MAX_CHARS = 4096
JWT_TTL = timedelta(hours=1)

DUMMY_PASSWORD_HASH = bcrypt.hashpw(
    hashlib.sha256(b"dummy-password-for-timing-only").digest(),
    bcrypt.gensalt(rounds=12),
)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(320), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)

    failed_login_attempts = db.Column(db.Integer, nullable=False, default=0)
    lockout_count = db.Column(db.Integer, nullable=False, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.utcnow())
    last_login_at = db.Column(db.DateTime, nullable=True)
    last_failed_login_at = db.Column(db.DateTime, nullable=True)


def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL",
        "sqlite:///app.db",
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())
    app.config["JWT_ISSUER"] = os.environ.get("JWT_ISSUER", "flask-auth")

    db.init_app(app)

    @app.post("/register")
    def register():
        body = request.get_json(silent=True) or {}

        email = normalize_email(body.get("email"))
        password = body.get("password")

        if not email or not valid_password(password):
            return jsonify({"error": "invalid_request"}), 400

        user = User(
            email=email,
            password_hash=hash_password(password),
        )

        db.session.add(user)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({"error": "email_unavailable"}), 409

        return jsonify({"status": "created"}), 201

    @app.post("/login")
    def login():
        body = request.get_json(silent=True) or {}

        email = normalize_email(body.get("email"))
        password = body.get("password")

        if not email or not valid_password(password):
            bcrypt.checkpw(password_material(""), DUMMY_PASSWORD_HASH)
            return auth_failed_response()

        now = datetime.utcnow()

        with db.session.begin():
            user = db.session.execute(
                db.select(User)
                .where(User.email == email)
                .with_for_update()
            ).scalar_one_or_none()

            if user is None:
                bcrypt.checkpw(password_material(password), DUMMY_PASSWORD_HASH)
                return auth_failed_response()

            password_ok = bcrypt.checkpw(
                password_material(password),
                user.password_hash,
            )

            currently_locked = user.locked_until is not None and user.locked_until > now

            if currently_locked or not password_ok:
                user.last_failed_login_at = now

                if not currently_locked:
                    user.failed_login_attempts += 1

                    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                        user.lockout_count += 1
                        user.failed_login_attempts = 0
                        user.locked_until = now + timedelta(
                            seconds=lockout_duration_seconds(user.lockout_count)
                        )

                return auth_failed_response()

            user.failed_login_attempts = 0
            user.lockout_count = 0
            user.locked_until = None
            user.last_login_at = now

            token = issue_access_token(app, user, now)

            return jsonify({"access_token": token, "token_type": "Bearer"}), 200

    return app


def normalize_email(value):
    if not isinstance(value, str):
        return None

    email = value.strip().lower()

    if not email or len(email) > 320 or "@" not in email:
        return None

    return email


def valid_password(value):
    return isinstance(value, str) and 0 < len(value) <= PASSWORD_MAX_CHARS


def password_material(password):
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password):
    return bcrypt.hashpw(password_material(password), bcrypt.gensalt(rounds=12))


def lockout_duration_seconds(lockout_count):
    multiplier = 2 ** max(lockout_count - 1, 0)
    return min(BASE_LOCKOUT_SECONDS * multiplier, MAX_LOCKOUT_SECONDS)


def auth_failed_response():
    return jsonify({"error": "invalid_credentials"}), 401


def issue_access_token(app, user, now):
    token = jwt.encode(
        {
            "sub": str(user.id),
            "email": user.email,
            "iat": now,
            "exp": now + JWT_TTL,
            "iss": app.config["JWT_ISSUER"],
        },
        app.config["SECRET_KEY"],
        algorithm="HS256",
    )

    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return token


app = create_app()

with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)