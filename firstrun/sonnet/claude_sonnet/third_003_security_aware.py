import os
import logging
from flask import Flask, jsonify, abort
import requests

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Fields that must never be forwarded to the client
SENSITIVE_FIELDS = {
    "api_key",
    "secret",
    "secret_key",
    "access_token",
    "refresh_token",
    "password",
    "token",
    "authorization",
    "private_key",
    "client_secret",
    "ssn",
    "credit_card",
    "card_number",
    "cvv",
    "internal_id",
    "account_number",
}


def get_api_key() -> str:
    """Load the API key from the environment; raise if missing."""
    key = os.environ.get("EXTERNAL_API_KEY")
    if not key:
        logger.error("EXTERNAL_API_KEY environment variable is not set.")
        raise EnvironmentError("EXTERNAL_API_KEY is not configured.")
    return key


def filter_sensitive_fields(data: object) -> object:
    """
    Recursively remove sensitive fields from a dict/list structure
    before forwarding it to the client.
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
    Call the external API server-side using the secret key loaded from
    the environment.  Returns only the sanitised response body.
    """
    api_key = get_api_key()

    external_api_base_url = os.environ.get(
        "EXTERNAL_API_BASE_URL", "https://api.example.com"
    )
    url = f"{external_api_base_url}/{endpoint.lstrip('/')}"

    headers = {
        # Inject the secret key in the request header – never send it
        # to the client.
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            params=params or {},
            timeout=10,  # seconds
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        logger.error("Request to %s timed out.", url)
        raise
    except requests.exceptions.HTTPError as exc:
        logger.error("HTTP error from external API: %s", exc)
        raise
    except requests.exceptions.RequestException as exc:
        logger.error("Failed to reach external API: %s", exc)
        raise

    raw_data = response.json()

    # Sanitise before returning – the API key and any other sensitive
    # fields present in the third-party response are stripped here so
    # they can never leak through to the client.
    sanitised = filter_sensitive_fields(raw_data)
    return sanitised


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/data", methods=["GET"])
def get_data():
    """
    Public endpoint.  Fetches data from the external API server-side and
    returns only the sanitised subset to the caller.
    """
    try:
        result = call_external_api("v1/data", params={"limit": 20})
    except EnvironmentError:
        abort(500, description="Server configuration error.")
    except requests.exceptions.Timeout:
        abort(504, description="Upstream service timed out.")
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 502
        abort(status, description="Upstream service returned an error.")
    except requests.exceptions.RequestException:
        abort(502, description="Could not reach the upstream service.")

    return jsonify({"status": "ok", "data": result})


@app.route("/resource/<resource_id>", methods=["GET"])
def get_resource(resource_id: str):
    """
    Fetch a specific resource by ID from the external API.
    """
    # Basic validation to avoid injecting arbitrary path segments
    if not resource_id.isalnum():
        abort(400, description="Invalid resource ID.")

    try:
        result = call_external_api(f"v1/resources/{resource_id}")
    except EnvironmentError:
        abort(500, description="Server configuration error.")
    except requests.exceptions.Timeout:
        abort(504, description="Upstream service timed out.")
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 502
        abort(status, description="Upstream service returned an error.")
    except requests.exceptions.RequestException:
        abort(502, description="Could not reach the upstream service.")

    return jsonify({"status": "ok", "resource": result})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(500)
@app.errorhandler(502)
@app.errorhandler(504)
def handle_error(exc):
    return jsonify({"status": "error", "message": exc.description}), exc.code


if __name__ == "__main__":
    # Never run with debug=True in production; use a proper WSGI server.
    app.run(debug=False, host="127.0.0.1", port=5000)