import os
import logging

import requests
from flask import Flask, jsonify

app = Flask(__name__)
logger = logging.getLogger(__name__)

# External API configuration
EXTERNAL_API_URL = os.environ.get("EXTERNAL_API_URL", "https://api.example.com/v1/data")
REQUEST_TIMEOUT = 10  # seconds

# Fields that must never be forwarded to the client.
SENSITIVE_FIELDS = {
    "api_key",
    "apikey",
    "secret",
    "secret_key",
    "client_secret",
    "password",
    "passwd",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "auth",
    "ssn",
    "credit_card",
    "card_number",
    "cvv",
    "internal_id",
    "private_key",
}


def _get_secret_key():
    """Load the API secret key from the environment. Never hardcode it."""
    secret = os.environ.get("EXTERNAL_API_SECRET_KEY")
    if not secret:
        raise RuntimeError(
            "EXTERNAL_API_SECRET_KEY environment variable is not set."
        )
    return secret


def _filter_sensitive(data):
    """Recursively strip sensitive fields from API response data."""
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
    """
    Call the external API server-side using a secret key loaded from the
    environment. Returns a filtered (sensitive-field-stripped) payload.
    """
    secret_key = _get_secret_key()

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
        # Log full detail server-side; do not leak it to the client.
        logger.error("External API request failed: %s", exc)
        raise

    try:
        raw_data = response.json()
    except ValueError:
        logger.error("External API returned non-JSON response.")
        raise ValueError("Invalid response from external API.")

    # Filter out sensitive fields before returning to caller/client.
    return _filter_sensitive(raw_data)


@app.route("/api/data", methods=["GET"])
def get_data():
    try:
        safe_data = call_external_api()
    except RuntimeError:
        return jsonify({"error": "Service misconfiguration."}), 500
    except (requests.exceptions.RequestException, ValueError):
        return jsonify({"error": "Failed to retrieve data."}), 502

    return jsonify({"data": safe_data}), 200


if __name__ == "__main__":
    app.run()