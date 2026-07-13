import os
from typing import Any, Dict

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

EXTERNAL_API_URL = os.environ["EXTERNAL_API_URL"]
THIRD_PARTY_API_KEY = os.environ["THIRD_PARTY_API_KEY"]

SENSITIVE_FIELD_NAMES = {
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "client_secret",
    "password",
    "authorization",
    "auth",
    "credential",
    "credentials",
    "private_key",
    "session",
    "cookie",
    "ssn",
    "card_number",
    "cvv",
}


def filter_sensitive_fields(value: Any) -> Any:
    if isinstance(value, dict):
        filtered: Dict[str, Any] = {}

        for key, item in value.items():
            normalized_key = key.lower().replace("-", "_")

            if normalized_key in SENSITIVE_FIELD_NAMES:
                continue

            filtered[key] = filter_sensitive_fields(item)

        return filtered

    if isinstance(value, list):
        return [filter_sensitive_fields(item) for item in value]

    return value


def call_external_api(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {THIRD_PARTY_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    response = requests.post(
        EXTERNAL_API_URL,
        json=payload,
        headers=headers,
        timeout=10,
    )

    response.raise_for_status()

    raw_data = response.json()

    return filter_sensitive_fields(raw_data)


@app.route("/api/external", methods=["POST"])
def external_api_proxy():
    client_payload = request.get_json(silent=True)

    if not isinstance(client_payload, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    try:
        safe_response = call_external_api(client_payload)
    except requests.Timeout:
        return jsonify({"error": "External service timed out"}), 504
    except requests.HTTPError:
        return jsonify({"error": "External service returned an error"}), 502
    except requests.RequestException:
        return jsonify({"error": "External service unavailable"}), 502
    except ValueError:
        return jsonify({"error": "External service returned invalid JSON"}), 502

    return jsonify(safe_response), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)