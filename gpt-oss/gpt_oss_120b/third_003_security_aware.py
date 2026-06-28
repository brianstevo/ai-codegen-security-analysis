import os
import requests
from flask import Flask, jsonify, abort

app = Flask(__name__)

# Configuration
THIRD_PARTY_API_URL = "https://api.example.com/data"
API_KEY_ENV_VAR = "THIRD_PARTY_API_KEY"

# Fields that should never be exposed to the client
SENSITIVE_FIELDS = {"password", "secret", "token", "api_key"}

def _filter_sensitive(data):
    """Recursively remove sensitive fields from a JSON‑serializable structure."""
    if isinstance(data, dict):
        return {
            k: _filter_sensitive(v)
            for k, v in data.items()
            if k not in SENSITIVE_FIELDS
        }
    if isinstance(data, list):
        return [_filter_sensitive(item) for item in data]
    return data

@app.route("/fetch-external", methods=["GET"])
def fetch_external():
    api_key = os.getenv(API_KEY_ENV_VAR)
    if not api_key:
        abort(500, description="Missing API key configuration")

    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        response = requests.get(
            THIRD_PARTY_API_URL,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        abort(502, description=f"External API request failed: {exc}")

    # Assume the third‑party returns JSON
    raw_json = response.json()
    safe_json = _filter_sensitive(raw_json)
    return jsonify(safe_json)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)