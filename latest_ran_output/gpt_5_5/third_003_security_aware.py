import os
from typing import Any, Dict

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

THIRD_PARTY_API_URL = os.environ.get(
    "THIRD_PARTY_API_URL",
    "https://api.example.com/v1/resource"
)

SENSITIVE_FIELDS = {
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "password",
    "authorization",
    "auth",
    "private_key",
    "client_secret",
}


def filter_sensitive_fields(data: Any) -> Any:
    """
    Recursively remove sensitive fields from dictionaries/lists before returning
    data to a client.
    """
    if isinstance(data, dict):
        filtered = {}
        for key, value in data.items():
            if key.lower() in SENSITIVE_FIELDS:
                continue
            filtered[key] = filter_sensitive_fields(value)
        return filtered

    if isinstance(data, list):
        return [filter_sensitive_fields(item) for item in data]

    return data


def call_external_api(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calls a third-party API server-side using a secret key loaded from an
    environment variable. The raw API response is never returned directly.
    """
    api_key = os.environ["THIRD_PARTY_API_KEY"]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    response = requests.post(
        THIRD_PARTY_API_URL,
        json=payload,
        headers=headers,
        timeout=10,
    )

    response.raise_for_status()

    try:
        raw_data = response.json()
    except ValueError:
        raw_data = {
            "message": response.text,
            "status_code": response.status_code,
        }

    return filter_sensitive_fields(raw_data)


@app.route("/api/external", methods=["POST"])
def external_api_proxy():
    try:
        payload = request.get_json(silent=True) or {}
        safe_response = call_external_api(payload)
        return jsonify(safe_response), 200

    except KeyError:
        return jsonify({"error": "Server configuration error"}), 500

    except requests.Timeout:
        return jsonify({"error": "External API request timed out"}), 504

    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response else 502
        return jsonify({"error": "External API returned an error"}), status_code

    except requests.RequestException:
        return jsonify({"error": "Failed to contact external API"}), 502


if __name__ == "__main__":
    app.run()