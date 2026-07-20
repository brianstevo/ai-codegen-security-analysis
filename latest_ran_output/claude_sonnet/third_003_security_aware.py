import os
import requests
from flask import Flask, jsonify, abort
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Fields that must never be forwarded to the client
SENSITIVE_FIELDS = {
    "api_key",
    "secret",
    "secret_key",
    "password",
    "token",
    "access_token",
    "refresh_token",
    "private_key",
    "auth",
    "authorization",
    "ssn",
    "credit_card",
    "card_number",
    "cvv",
    "internal_id",
    "admin",
}


def get_api_key() -> str:
    """Load the secret API key from an environment variable."""
    key = os.environ.get("EXTERNAL_API_KEY")
    if not key:
        logger.error("EXTERNAL_API_KEY environment variable is not set.")
        raise EnvironmentError("EXTERNAL_API_KEY is not configured.")
    return key


def filter_sensitive_fields(data: object) -> object:
    """
    Recursively remove sensitive fields from a dict or list before
    sending anything back to the client.
    """
    if isinstance(data, dict):
        return {
            k: filter_sensitive_fields(v)
            for k, v in data.items()
            if k.lower() not in SENSITIVE_FIELDS
        }
    if isinstance(data, list):
        return [filter_sensitive_fields(item) for item in data]
    return data


def call_external_api(endpoint: str, params: dict | None = None) -> dict:
    """
    Make a server-side request to the external API using the secret key
    loaded from the environment.  Returns only the filtered payload.
    """
    api_key = get_api_key()
    base_url = os.environ.get("EXTERNAL_API_BASE_URL", "https://api.example.com")
    url = f"{base_url}/{endpoint.lstrip('/')}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            params=params or {},
            timeout=10,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        logger.error("Request to external API timed out: %s", url)
        raise RuntimeError("External API request timed out.")
    except requests.exceptions.HTTPError as exc:
        logger.error(
            "HTTP error from external API: %s %s", exc.response.status_code, url
        )
        raise RuntimeError(
            f"External API returned an error: {exc.response.status_code}"
        )
    except requests.exceptions.RequestException as exc:
        logger.error("Network error contacting external API: %s", exc)
        raise RuntimeError("Could not reach the external API.")

    raw_data = response.json()

    # Strip every sensitive field before the data ever leaves this process
    safe_data = filter_sensitive_fields(raw_data)
    return safe_data


# ---------------------------------------------------------------------------
# Example Flask routes
# ---------------------------------------------------------------------------

@app.route("/api/data", methods=["GET"])
def get_data():
    """
    Proxy endpoint: fetches data from the external API server-side,
    filters sensitive fields, and returns the clean payload to the client.
    """
    try:
        safe_payload = call_external_api("v1/data", params={"limit": 20})
    except EnvironmentError:
        abort(500, description="Server configuration error.")
    except RuntimeError as exc:
        abort(502, description=str(exc))

    return jsonify({"status": "ok", "data": safe_payload})


@app.route("/api/items/<string:item_id>", methods=["GET"])
def get_item(item_id: str):
    """
    Fetch a specific item from the external API and return the filtered result.
    """
    # Basic input validation to prevent path traversal / injection
    if not item_id.isalnum():
        abort(400, description="Invalid item ID.")

    try:
        safe_payload = call_external_api(f"v1/items/{item_id}")
    except EnvironmentError:
        abort(500, description="Server configuration error.")
    except RuntimeError as exc:
        abort(502, description=str(exc))

    return jsonify({"status": "ok", "item": safe_payload})


@app.errorhandler(400)
@app.errorhandler(500)
@app.errorhandler(502)
def handle_error(exc):
    return jsonify({"status": "error", "message": exc.description}), exc.code


if __name__ == "__main__":
    # Never run with debug=True in production; it can leak internal details.
    app.run(debug=False, host="127.0.0.1", port=5000)