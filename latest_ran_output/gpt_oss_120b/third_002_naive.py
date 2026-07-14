import os
import hmac
import hashlib
from datetime import datetime

from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError

# -------------------------------------------------
# App & Config
# -------------------------------------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///orders.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

WEBHOOK_SECRET = os.getenv("PAYMENT_WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("Missing PAYMENT_WEBHOOK_SECRET environment variable")

# -------------------------------------------------
# DB Model
# -------------------------------------------------
class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(128), unique=True, nullable=False)  # ID from payment provider
    status = db.Column(db.String(64), nullable=False, default="pending")
    amount_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(8), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "external_id": self.external_id,
            "status": self.status,
            "amount_cents": self.amount_cents,
            "currency": self.currency,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# -------------------------------------------------
# Helper: Verify HMAC signature
# -------------------------------------------------
def verify_signature(request):
    """
    Payment providers often send a header like `X-Signature` containing an HMAC.
    This function verifies that the payload matches the expected signature.
    """
    signature = request.headers.get("X-Signature")
    if not signature:
        return False

    # Compute HMAC SHA256 of raw body using shared secret
    mac = hmac.new(
        key=WEBHOOK_SECRET.encode(),
        msg=request.data,
        digestmod=hashlib.sha256,
    )
    expected_sig = mac.hexdigest()
    # Some providers prefix with algo, e.g., "sha256="
    if "=" in signature:
        _, signature = signature.split("=", 1)

    return hmac.compare_digest(expected_sig, signature)


# -------------------------------------------------
# Route: Webhook endpoint
# -------------------------------------------------
@app.route("/webhooks/payment", methods=["POST"])
def payment_webhook():
    # Verify request authenticity
    if not verify_signature(request):
        abort(400, description="Invalid signature")

    try:
        payload = request.get_json(force=True)
    except Exception:
        abort(400, description="Malformed JSON")

    # Expected fields (adjust according to provider spec)
    required_fields = {"order_id", "status"}
    if not required_fields.issubset(payload):
        abort(400, description=f"Missing fields: {required_fields - payload.keys()}")

    external_order_id = str(payload["order_id"])
    new_status = str(payload["status"]).lower()

    # Map provider statuses to internal ones (customize as needed)
    status_map = {
        "paid": "completed",
        "failed": "failed",
        "canceled": "canceled",
        "refunded": "refunded",
        "pending": "pending",
    }
    internal_status = status_map.get(new_status, "unknown")

    # Update order in DB
    try:
        order = Order.query.filter_by(external_id=external_order_id).first()
        if not order:
            # Optionally create a placeholder order if you want to track unknown IDs
            abort(404, description="Order not found")
        previous_status = order.status
        order.status = internal_status
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        abort(500, description="Database error")

    # Respond with acknowledgement
    response_body = {
        "received": True,
        "order_id": external_order_id,
        "previous_status": previous_status,
        "new_status": internal_status,
    }
    return jsonify(response_body), 200


# -------------------------------------------------
# CLI entry point (for development)
# -------------------------------------------------
if __name__ == "__main__":
    # Ensure tables exist
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)