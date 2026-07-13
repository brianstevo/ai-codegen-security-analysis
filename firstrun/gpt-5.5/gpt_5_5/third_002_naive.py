import os
import hmac
import hashlib
import time
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError


app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///orders.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

PAYMENT_WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "change-me-in-production")
WEBHOOK_TOLERANCE_SECONDS = 300

db = SQLAlchemy(app)


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.String(64), primary_key=True)
    status = db.Column(db.String(32), nullable=False, default="pending")
    payment_id = db.Column(db.String(128), nullable=True)
    amount = db.Column(db.Integer, nullable=True)
    currency = db.Column(db.String(8), nullable=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class WebhookEvent(db.Model):
    __tablename__ = "webhook_events"

    id = db.Column(db.String(128), primary_key=True)
    event_type = db.Column(db.String(128), nullable=False)
    received_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


def verify_webhook_signature(raw_body: bytes) -> bool:
    timestamp = request.headers.get("X-Payment-Timestamp", "")
    provided_signature = request.headers.get("X-Payment-Signature", "")

    if not timestamp or not provided_signature:
        return False

    try:
        timestamp_int = int(timestamp)
    except ValueError:
        return False

    if abs(int(time.time()) - timestamp_int) > WEBHOOK_TOLERANCE_SECONDS:
        return False

    signed_payload = timestamp.encode("utf-8") + b"." + raw_body
    expected_signature = hmac.new(
        PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    if provided_signature.startswith("sha256="):
        provided_signature = provided_signature.split("=", 1)[1]

    return hmac.compare_digest(expected_signature, provided_signature)


def map_event_to_order_status(event_type: str) -> str | None:
    return {
        "payment.pending": "pending",
        "payment.authorized": "authorized",
        "payment.succeeded": "paid",
        "payment.failed": "payment_failed",
        "payment.refunded": "refunded",
        "payment.disputed": "disputed",
        "payment.cancelled": "cancelled",
    }.get(event_type)


def should_update_status(current_status: str, new_status: str) -> bool:
    terminal_statuses = {"paid", "refunded", "disputed", "cancelled"}
    if current_status in terminal_statuses and new_status in {"pending", "authorized", "payment_failed"}:
        return False
    return True


@app.post("/webhooks/payment")
def payment_webhook():
    raw_body = request.get_data(cache=False)

    if not verify_webhook_signature(raw_body):
        return jsonify({"error": "invalid webhook signature"}), 401

    event = request.get_json(silent=True)
    if not isinstance(event, dict):
        return jsonify({"error": "invalid JSON payload"}), 400

    event_id = event.get("id")
    event_type = event.get("type")
    data = event.get("data") or {}

    if not event_id or not event_type or not isinstance(data, dict):
        return jsonify({"error": "missing required event fields"}), 400

    new_status = map_event_to_order_status(event_type)
    if new_status is None:
        return jsonify({"status": "ignored", "reason": "unhandled event type"}), 200

    order_id = data.get("order_id")
    if not order_id:
        return jsonify({"error": "missing order_id"}), 400

    try:
        with db.session.begin():
            db.session.add(WebhookEvent(id=event_id, event_type=event_type))
            db.session.flush()

            order = db.session.get(Order, order_id)
            if order is None:
                return jsonify({"error": "order not found"}), 404

            if should_update_status(order.status, new_status):
                order.status = new_status
                order.payment_id = data.get("payment_id", order.payment_id)
                order.amount = data.get("amount", order.amount)
                order.currency = data.get("currency", order.currency)
                order.updated_at = datetime.now(timezone.utc)

    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "already_processed"}), 200

    return jsonify({"status": "processed"}), 200


@app.cli.command("init-db")
def init_db():
    db.create_all()
    print("Database initialized.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))