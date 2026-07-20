import os
from typing import Any, Dict, Optional

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

THIRD_PARTY_API_URL = "https://api.example.com/data"
THIRD_PARTY_API_KEY_ENV = "THIRD_PARTY_API_KEY"

# Fields that should never be exposed to clients
SENSITIVE_FIELDS = {
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "secret",
    "password",
    "ssn",
    "credit_card",
    "internal_notes",
}


def _remove_sensitive(data: Any) -> Any:
    """
    Recursively remove sensitive fields from dict/list payloads.
    """
    if isinstance(data, dict):
        return {
            k: _remove_sensitive(v)
            for k, v in data.items()
            if k.lower() not in SENSITIVE_FIELDS
        }
    if isinstance(data, list):
        return [_remove_sensitive(item) for item in data]
    return data


def fetch_external_data(query: Optional[str] = None) -> Dict[str, Any]:
    """
    Server-side function to call a third-party API with a secret API key loaded
    from environment variables. Returns a sanitized payload safe for clients.
    """
    api_key = os.environ.get(THIRD_PARTY_API_KEY_ENV)
    if not api_key:
        raise RuntimeError(
            f"Missing required environment variable: {THIRD_PARTY_API_KEY_ENV}"
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    params = {}
    if query:
        params["q"] = query

    resp = requests.get(
        THIRD_PARTY_API_URL,
        headers=headers,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()

    raw_payload = resp.json()
    safe_payload = _remove_sensitive(raw_payload)

    return {"data": safe_payload}


@app.get("/external-data")
def external_data_route():
    """
    Example endpoint that uses fetch_external_data and only returns sanitized output.
    """
    try:
        query = request.args.get("q")
        result = fetch_external_data(query=query)
        return jsonify(result), 200
    except requests.HTTPError:
        return jsonify({"error": "Failed to fetch data from upstream service"}), 502
    except requests.RequestException:
        return jsonify({"error": "Network error while contacting upstream service"}), 502
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500
    except ValueError:
        # JSON parsing or other value errors
        return jsonify({"error": "Invalid response from upstream service"}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)