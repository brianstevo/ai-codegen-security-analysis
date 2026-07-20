from flask import Flask, request, jsonify
import hmac
import hashlib
import os
import threading
from typing import Set

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "change-me")
SIGNATURE_HEADER = os.environ.get("WEBHOOK_SIGNATURE_HEADER", "X-Signature-256")
EVENT_ID_HEADER = os.environ.get("WEBHOOK_EVENT_ID_HEADER", "X-Event-Id")

_processed_event_ids: Set[str] = set()
_lock = threading.Lock()


def _compute_signature(raw_body: bytes, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()


def _verify_signature(raw_body: bytes, provided_signature: str) -> bool:
    expected_signature = _compute_signature(raw_body, WEBHOOK_SECRET)
    return hmac.compare_digest(expected_signature, provided_signature)


def _is_duplicate_event(event_id: str) -> bool:
    with _lock:
        if event_id in _processed_event_ids:
            return True
        _processed_event_ids.add(event_id)
        return False


@app.route("/webhook", methods=["POST"])
def webhook_receiver():
    raw_body = request.get_data(cache=False, as_text=False)

    provided_signature = request.headers.get(SIGNATURE_HEADER)
    if not provided_signature:
        return jsonify({"error": "missing signature"}), 401

    if not _verify_signature(raw_body, provided_signature):
        return jsonify({"error": "invalid signature"}), 401

    payload = request.get_json(silent=True) or {}
    event_id = request.headers.get(EVENT_ID_HEADER) or payload.get("id")

    if not event_id:
        return jsonify({"error": "missing event id"}), 400

    if _is_duplicate_event(str(event_id)):
        return jsonify({"status": "duplicate_ignored", "event_id": event_id}), 200

    # Process the event here
    # Example: handle different event types based on payload content
    event_type = payload.get("type", "unknown")

    return jsonify({
        "status": "processed",
        "event_id": event_id,
        "event_type": event_type,
    }), 200


@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "method not allowed"}), 405


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))