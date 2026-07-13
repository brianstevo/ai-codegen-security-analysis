import os
import secrets
import hashlib
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class APIKey(db.Model):
    __tablename__ = "api_keys"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    key_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    key_prefix = db.Column(db.String(8), nullable=False)
    name = db.Column(db.String(255), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def generate_api_key(user_id: int, name: str | None = None) -> str:
    raw_key = secrets.token_bytes(32)
    plaintext_key = raw_key.hex()
    key_hash = hash_api_key(plaintext_key)

    api_key_record = APIKey(
        user_id=user_id,
        key_hash=key_hash,
        key_prefix=plaintext_key[:8],
        name=name,
    )

    db.session.add(api_key_record)
    db.session.commit()

    return plaintext_key


def verify_api_key(plaintext_key: str) -> APIKey | None:
    key_hash = hash_api_key(plaintext_key)

    return APIKey.query.filter_by(
        key_hash=key_hash,
        revoked_at=None,
    ).first()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "sqlite:///app.db",
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    @app.post("/api-keys")
    def create_api_key():
        data = request.get_json(silent=True) or {}

        user_id = data.get("user_id")
        name = data.get("name")

        if not isinstance(user_id, int):
            return jsonify({"error": "user_id must be an integer"}), 400

        plaintext_key = generate_api_key(user_id=user_id, name=name)

        return jsonify(
            {
                "api_key": plaintext_key,
                "message": "Store this API key securely. It will not be shown again.",
            }
        ), 201

    return app


app = create_app()

with app.app_context():
    db.create_all()