import os
import json
import hmac
import time
import hashlib
import sqlite3
from datetime import datetime, timezone
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "orders.db")
WEBHOOK_SECRET = os.environ.get("PAYMENT_WEBHOOK_SECRET", "change-me-in-production")
WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = int(
    os.environ.get("WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS", "300")
)

PROVIDER_EVENT_TO_ORDER_STATUS = {
    "payment.succeeded": "paid",
    "payment.failed": "payment_failed",
    "payment.canceled": "canceled",
    "payment.refunded": "refunded",
    "checkout.completed": "paid",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'pending',
                payment_provider_id TEXT,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS processed_webhooks (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                order_id TEXT,
                received_at TEXT NOT NULL
            )
            """
        )

        # Optional demo seed order. Remove in production.
        conn.execute(
            """
            INSERT OR IGNORE INTO orders (id, status, payment_provider_id, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            ("order_123", "pending", None, utc_now_iso()),
        )


def verify_webhook_signature(raw_body: bytes) -> bool:
    """
    Expected headers:
      X-Webhook-Timestamp: unix timestamp in seconds
      X-Webhook-Signature: sha256=<hex_digest> or <hex_digest>

    Signature payload:
      "{timestamp}.{raw_body}"
    """
    timestamp = request.headers.get("X-Webhook-Timestamp", "")
    signature_header = request.headers.get("X-Webhook-Signature", "")

    if not timestamp or not signature_header:
        return False

    try:
        timestamp_int = int(timestamp)
    except ValueError:
        return False

    now = int(time.time())
    if abs(now - timestamp_int) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
        return False

    provided_signature = signature_header
    if provided_signature.startswith("sha256="):
        provided_signature = provided_signature[len("sha256=") :]

    signed_payload = timestamp.encode("utf-8") + b"." + raw_body
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature, provided_signature)


def extract_order_id(event: dict) -> str | None:
    data = event.get("data") or {}
    obj = data.get("object") or data

    return (
        obj.get("order_id")
        or obj.get("metadata", {}).get("order_id")
        or obj.get("client_reference_id")
    )


def extract_payment_provider_id(event: dict) -> str | None:
    data = event.get("data") or {}
    obj = data.get("object") or data

    return obj.get("id") or obj.get("payment_id") or obj.get("payment_intent")


@app.post("/webhooks/payment-provider")
def payment_provider_webhook():
    raw_body = request.get_data(cache=False)

    if not verify_webhook_signature(raw_body):
        abort(401)

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        abort(400)

    event_id = event.get("id")
    event_type = event.get("type")

    if not event_id or not event_type:
        return jsonify({"error": "Webhook event must include id and type"}), 400

    new_order_status = PROVIDER_EVENT_TO_ORDER_STATUS.get(event_type)
    if not new_order_status:
        return jsonify({"ok": True, "ignored": True, "reason": "unhandled_event_type"}), 200

    order_id = extract_order_id(event)
    if not order_id:
        return jsonify({"error": "Webhook event does not include an order id"}), 400

    payment_provider_id = extract_payment_provider_id(event)
    now = utc_now_iso()

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")

        order = conn.execute(
            "SELECT id, status FROM orders WHERE id = ?",
            (order_id,),
        ).fetchone()

        if order is None:
            conn.rollback()
            return jsonify({"error": "Order not found", "order_id": order_id}), 404

        try:
            conn.execute(
                """
                INSERT INTO processed_webhooks (event_id, event_type, order_id, received_at)
                VALUES (?, ?, ?, ?)
                """,
                (event_id, event_type, order_id, now),
            )
        except sqlite3.IntegrityError:
            conn.rollback()
            return jsonify({"ok": True, "duplicate": True}), 200

        conn.execute(
            """
            UPDATE orders
            SET status = ?,
                payment_provider_id = COALESCE(?, payment_provider_id),
                updated_at = ?
            WHERE id = ?
            """,
            (new_order_status, payment_provider_id, now, order_id),
        )

        conn.commit()

        return jsonify(
            {
                "ok": True,
                "event_id": event_id,
                "order_id": order_id,
                "previous_status": order["status"],
                "new_status": new_order_status,
            }
        ), 200

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/orders/<order_id>")
def get_order(order_id: str):
    with get_db() as conn:
        order = conn.execute(
            """
            SELECT id, status, payment_provider_id, updated_at
            FROM orders
            WHERE id = ?
            """,
            (order_id,),
        ).fetchone()

    if order is None:
        abort(404)

    return jsonify(dict(order)), 200


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))