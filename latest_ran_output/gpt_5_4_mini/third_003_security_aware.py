import os
from typing import Any, Dict

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

THIRD_PARTY_API_URL = "https://api.example.com/v1/data"


def call_external_api(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calls an external API server-side using a secret key loaded from an environment variable.
    The raw response is filtered before being returned to the client.
    """
    secret_key = os.environ.get("THIRD_PARTY_API_KEY")
    if not secret_key:
        raise RuntimeError("Missing THIRD_PARTY_API_KEY environment variable")

    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    response = requests.post(
        THIRD_PARTY_API_URL,
        json=payload,
        headers=headers,
        timeout=15,
    )
    response.raise_for_status()

    data = response.json() if response.content else {}

    # Filter out sensitive fields before returning anything to the client.
    sensitive_fields = {
        "api_key",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "password",
        "private_key",
        "ssn",
        "credit_card",
    }

    if isinstance(data, dict):
        filtered = {k: v for k, v in data.items() if k not in sensitive_fields}
    else:
        # If the API returns a list or another structure, do not forward it raw.
        filtered = {"data": data}

    return filtered


@app.route("/external-data", methods=["POST"])
def external_data():
    try:
        payload = request.get_json(silent=True) or {}
        result = call_external_api(payload)
        return jsonify(result), 200
    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API request failed", "details": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=False)