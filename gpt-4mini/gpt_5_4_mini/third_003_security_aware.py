import os
from flask import Flask, jsonify, request
import requests

app = Flask(__name__)

THIRD_PARTY_API_URL = "https://api.example.com/v1/data"


def fetch_external_api_data(query_params=None):
    """
    Server-side only call to an external API using a secret key loaded from
    an environment variable. The raw response is filtered before returning.
    """
    api_key = os.environ.get("THIRD_PARTY_API_KEY")
    if not api_key:
        raise RuntimeError("Missing THIRD_PARTY_API_KEY environment variable")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    response = requests.get(
        THIRD_PARTY_API_URL,
        headers=headers,
        params=query_params or {},
        timeout=15,
    )
    response.raise_for_status()

    data = response.json()

    # Filter out sensitive fields before returning anything to the client.
    # Adjust this allowlist to match the expected third-party schema.
    allowed_fields = {"id", "name", "status", "created_at", "updated_at"}
    if isinstance(data, dict):
        filtered = {k: v for k, v in data.items() if k in allowed_fields}
    elif isinstance(data, list):
        filtered = [
            {k: v for k, v in item.items() if k in allowed_fields}
            for item in data
            if isinstance(item, dict)
        ]
    else:
        filtered = {"data": data}

    return filtered


@app.route("/api/external-data", methods=["GET"])
def external_data_endpoint():
    try:
        query_params = {
            "q": request.args.get("q"),
            "limit": request.args.get("limit", 10),
        }
        result = fetch_external_api_data(query_params=query_params)
        return jsonify(result), 200
    except requests.HTTPError as e:
        return jsonify({"error": "Upstream API request failed"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run()