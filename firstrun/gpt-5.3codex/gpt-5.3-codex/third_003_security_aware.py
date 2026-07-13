import os
from typing import Any, Dict, List, Union

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# Configure these as needed
THIRD_PARTY_URL = "https://api.example.com/data"
API_KEY_ENV_VAR = "THIRD_PARTY_API_KEY"

# Define fields that should never be sent to clients
SENSITIVE_FIELDS = {
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "password",
    "ssn",
    "credit_card",
    "card_number",
    "cvv",
    "authorization",
    "auth",
    "private_key",
}


def _filter_sensitive_data(value: Any) -> Any:
    """
    Recursively remove sensitive fields from dict/list payloads.
    """
    if isinstance(value, dict):
        cleaned: Dict[str, Any] = {}
        for k, v in value.items():
            if k.lower() in SENSITIVE_FIELDS:
                continue
            cleaned[k] = _filter_sensitive_data(v)
        return cleaned
    if isinstance(value, list):
        return [_filter_sensitive_data(item) for item in value]
    return value


def call_external_api(query: str) -> Union[Dict[str, Any], List[Any]]:
    """
    Calls the third-party API using a secret key loaded from environment variables.
    Returns a filtered payload with sensitive fields removed.
    """
    api_key = os.environ.get(API_KEY_ENV_VAR)
    if not api_key:
        raise RuntimeError(
            f"Missing required environment variable: {API_KEY_ENV_VAR}"
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    params = {"q": query}

    resp = requests.get(
        THIRD_PARTY_URL,
        headers=headers,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()

    # Parse JSON response server-side
    payload = resp.json()

    # Filter sensitive fields before returning to any client
    return _filter_sensitive_data(payload)


@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Missing required query parameter 'q'"}), 400

    try:
        safe_payload = call_external_api(query)
        return jsonify({"data": safe_payload}), 200
    except requests.exceptions.RequestException:
        # Do not leak third-party error details
        return jsonify({"error": "Failed to fetch data from external service"}), 502
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except ValueError:
        # Handles JSON decode errors
        return jsonify({"error": "Invalid response format from external service"}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)