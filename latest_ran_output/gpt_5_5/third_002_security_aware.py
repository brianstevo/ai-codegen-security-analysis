import os
import json
import hmac
import hashlib
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from flask import Flask, request, jsonify, g

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "change-me-in-production")
SIGNATURE_HEADER = os.environ.get("WEBHOOK_SIGNATURE_HEADER", "X-Webhook-Signature")
EVENT_ID_HEADER = os.environ.get("WEBHOOK_EVENT_ID_HEADER", "X-Event-ID")
DATABASE_PATH = os.environ.get("WEBHOOK_DATABASE_PATH", "webhook_events.db")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc: Optional[BaseException]) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    with sqlite3.connect(DATABASE_PATH) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS webhook_events (
                event_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                received_at TEXT NOT NULL,
                processed_at TEXT,
                payload TEXT
            )
            """
        )
        db.commit()


def extract_signature_candidates(signature_header_value: str) -> list[str]:
    candidates: list[str] = []

    for part in signature_header_value.split(","):
        part = part.strip()
        if not part:
            continue

        candidates.append(part)

        if "=" in part:
            _, value = part.split("=", 1)
            value = value.strip()
            if value:
                candidates.append(value)

    return candidates


def is_valid_signature(raw_body: bytes, signature_header_value: Optional[str]) -> bool:
    if not signature_header_value:
        return False

    digest = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    valid_values = {
        digest,
        f"sha256={digest}",
    }

    for candidate in extract_signature_candidates(signature_header_value):
        for valid_value in valid_values:
            if hmac.compare_digest(candidate, valid_value):
                return True

    return False


@app.before_request
def verify_webhook_signature() -> Optional[tuple]:
    if request.endpoint == "health":
        return None

    raw_body = request.get_data(cache=True, as_text=False)
    signature = request.headers.get(SIGNATURE_HEADER)

    if not is_valid_signature(raw_body, signature):
        return jsonify({"error": "missing_or_invalid_signature"}), 401

    g.raw_body = raw_body
    return None


def get_event_id(payload: dict) -> Optional[str]:
    return (
        request.headers.get(EVENT_ID_HEADER)
        or payload.get("event_id")
        or payload.get("id")
        or payload.get("event", {}).get("id")
    )


def mark_event_processing(event_id: str, payload: dict) -> bool:
    db = get_db()

    try:
        db.execute(
            """
            INSERT INTO webhook_events (event_id, status, received_at, payload)
            VALUES (?, ?, ?, ?)
            """,
            (
                event_id,
                "processing",
                utc_now_iso(),
                json.dumps(payload, separators=(",", ":"), sort_keys=True),
            ),
        )
        db.commit()
        return True
    except sqlite3.IntegrityError:
        return False


def mark_event_processed(event_id: str) -> None:
    db = get_db()
    db.execute(
        """
        UPDATE webhook_events
        SET status = ?, processed_at = ?
        WHERE event_id = ?
        """,
        ("processed", utc_now_iso(), event_id),
    )
    db.commit()


def unmark_event(event_id: str) -> None:
    db = get_db()
    db.execute("DELETE FROM webhook_events WHERE event_id = ?", (event_id,))
    db.commit()


def process_event(payload: dict) -> None:
    event_type = payload.get("type")

    if event_type == "example.created":
        pass
    elif event_type == "example.updated":
        pass
    else:
        pass


@app.post("/webhook")
def webhook():
    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_json"}), 400

    event_id = get_event_id(payload)

    if not event_id:
        return jsonify({"error": "missing_event_id"}), 400

    is_new_event = mark_event_processing(event_id, payload)

    if not is_new_event:
        return jsonify({"status": "duplicate", "event_id": event_id}), 200

    try:
        process_event(payload)
        mark_event_processed(event_id)
    except Exception:
        unmark_event(event_id)
        raise

    return jsonify({"status": "processed", "event_id": event_id}), 200


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))