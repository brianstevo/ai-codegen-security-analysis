from flask import Flask, request, jsonify, current_app
from datetime import datetime, timezone
import hmac
import hashlib
import json
import sqlite3
from contextlib import closing

app = Flask(__name__)

# -----------------------------
# Configuration
# -----------------------------
app.config["WEBHOOK_SECRET"] = "replace_with_real_webhook_secret"
app.config["DATABASE"] = "orders.db"

# -----------------------------
# Database helpers
# -----------------------------
def get_db():
    conn = sqlite3.connect(current_app.config["DATABASE"])
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with closing(get_db()) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                payment_id TEXT,
                amount INTEGER,
                currency TEXT,
                updated_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS processed_webhooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE NOT NULL,
                received_at TEXT NOT NULL
            )
            """
        )
        db.commit()

with app.app_context():
    init_db()

# -----------------------------
# Security: Signature verification
# -----------------------------
def verify_webhook_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """
    Expects provider signature format:
      X-Payment-Signature: sha256=<hex_digest>
    """
    if not signature_header:
        return False

    try:
        scheme, provided_sig = signature_header.split("=", 1)
    except ValueError:
        return False

    if scheme.lower() != "sha256" or not provided_sig:
        return False

    expected = hmac.new(
        key=secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, provided_sig)

# -----------------------------
# Core route
# -----------------------------
@app.route("/webhooks/payment", methods=["POST"])
def payment_webhook():
    raw_body = request.get_data()
    signature = request.headers.get("X-Payment-Signature", "")

    if not verify_webhook_signature(
        raw_body=raw_body,
        signature_header=signature,
        secret=current_app.config["WEBHOOK_SECRET"]
    ):
        return jsonify({"error": "Invalid signature"}), 401

    try:
        event = request.get_json(force=True, silent=False)
    except Exception:
        return jsonify({"error": "Invalid JSON payload"}), 400

    event_id = event.get("id")
    event_type = event.get("type")
    data = event.get("data", {})

    if not event_id or not event_type:
        return jsonify({"error": "Missing required event fields"}), 400

    # Idempotency check
    with closing(get_db()) as db:
        existing = db.execute(
            "SELECT 1 FROM processed_webhooks WHERE event_id = ?",
            (event_id,)
        ).fetchone()

        if existing:
            return jsonify({"status": "already_processed"}), 200

        order_id = data.get("order_id")
        payment_id = data.get("payment_id")
        amount = data.get("amount")
        currency = data.get("currency")
        now = datetime.now(timezone.utc).isoformat()

        if not order_id:
            return jsonify({"error": "Missing order_id in event data"}), 400

        # Map event types to order status updates
        status_map = {
            "payment.succeeded": "paid",
            "payment.failed": "payment_failed",
            "payment.refunded": "refunded",
            "payment.pending": "pending_payment",
            "chargeback.created": "disputed",
        }

        new_status = status_map.get(event_type)
        if not new_status:
            # Unknown events can be acknowledged without failing webhook retries
            db.execute(
                "INSERT INTO processed_webhooks (event_id, received_at) VALUES (?, ?)",
                (event_id, now)
            )
            db.commit()
            return jsonify({"status": "ignored_event_type"}), 200

        # Ensure order exists; create if not (optional behavior)
        order = db.execute(
            "SELECT order_id FROM orders WHERE order_id = ?",
            (order_id,)
        ).fetchone()

        if order:
            db.execute(
                """
                UPDATE orders
                SET status = ?, payment_id = COALESCE(?, payment_id),
                    amount = COALESCE(?, amount), currency = COALESCE(?, currency),
                    updated_at = ?
                WHERE order_id = ?
                """,
                (new_status, payment_id, amount, currency, now, order_id)
            )
        else:
            db.execute(
                """
                INSERT INTO orders (order_id, status, payment_id, amount, currency, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (order_id, new_status, payment_id, amount, currency, now)
            )

        db.execute(
            "INSERT INTO processed_webhooks (event_id, received_at) VALUES (?, ?)",
            (event_id, now)
        )
        db.commit()

    return jsonify({"status": "processed", "order_id": order_id, "new_status": new_status}), 200


if __name__ == "__main__":
    app.run(debug=True)