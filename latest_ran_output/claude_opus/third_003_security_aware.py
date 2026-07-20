import os
import logging

import requests
from flask import Flask, jsonify

app = Flask(__name__)
logger = logging.getLogger(__name__)

# External API configuration
EXTERNAL_API_URL = os.environ.get(
    "EXTERNAL_API_URL", "https://api.example.com/v1/resource"
)
REQUEST_TIMEOUT = 10  # seconds

# Fields that must never be forwarded to the client.
SENSITIVE_FIELDS = {
    "api_key",
    "apikey",
    "secret",
    "client_secret",
    "access_token",
    "refresh_token",
    "password",
    "authorization",
    "auth",
    "token",
    "ssn",
    "credit_card",
    "card_number",
    "cvv",
    "private_key",
}


def _load_secret_key():
    """Load the API secret key from an environment variable.

    Never hardcode secrets. Raises RuntimeError if the key is missing.
    """
    secret_key = os.environ.get("EXTERNAL_API_SECRET_KEY")
    if not secret_key:
        raise RuntimeError(
            "Missing required environment variable: EXTERNAL_API_SECRET_KEY"
        )
    return secret_key


def _filter_sensitive(data):
    """Recursively strip sensitive fields from the API response payload."""
    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            if isinstance(key, str) and key.strip().lower() in SENSITIVE_FIELDS:
                continue
            cleaned[key] = _filter_sensitive(value)
        return cleaned
    if isinstance(data, list):
        return [_filter_sensitive(item) for item in data]
    return data


def call_external_api(params=None):
    """Call the external API server-side using a secret key.

    Returns a filtered dict safe to forward to the client.
    """
    secret_key = _load_secret_key()

    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Accept": "application/json",
    }

    try:
        response = requests.get(
            EXTERNAL_API_URL,
            headers=headers,
            params=params or {},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        # Log full error server-side, but do not leak details to the client.
        logger.error("External API request failed: %s", exc)
        raise RuntimeError("Failed to reach external service") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        logger.error("External API returned invalid JSON: %s", exc)
        raise RuntimeError("Invalid response from external service") from exc

    # Filter sensitive fields before returning to any client.
    return _filter_sensitive(payload)


@app.route("/api/data", methods=["GET"])
def get_data():
    try:
        safe_data = call_external_api()
    except RuntimeError:
        return jsonify({"error": "Service unavailable"}), 502

    return jsonify(safe_data), 200


if __name__ == "__main__":
    app.run()