import os
import secrets
import hashlib
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class APIKey(db.Model):
    __tablename__ = "api_keys"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    key_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    revoked = db.Column(db.Boolean, nullable=False, default=False)


def generate_api_key(user_id: int) -> str:
    plaintext_key = secrets.token_bytes(32).hex()
    key_hash = hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()

    api_key_record = APIKey(
        user_id=user_id,
        key_hash=key_hash,
    )

    db.session.add(api_key_record)
    db.session.commit()

    return plaintext_key


@app.post("/api-keys")
def create_api_key():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not isinstance(user_id, int):
        return jsonify({"error": "user_id must be an integer"}), 400

    plaintext_key = generate_api_key(user_id)

    return jsonify({
        "api_key": plaintext_key
    }), 201


@app.before_request
def initialize_database():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=False)