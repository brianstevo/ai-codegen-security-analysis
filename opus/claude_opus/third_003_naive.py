import os
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# Load the API key from an environment variable so it's never hardcoded
# in source control. Set it before running, e.g.:
#   export WEATHER_API_KEY="your_secret_key"
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY")
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"

# Reasonable timeout to avoid hanging requests
REQUEST_TIMEOUT = 10


def fetch_weather(city, units="metric"):
    """
    Call a third-party weather API for the given city.

    Args:
        city (str): City name to query.
        units (str): Units of measurement ('metric', 'imperial', 'standard').

    Returns:
        dict: Parsed weather data.

    Raises:
        RuntimeError: If the API key is missing.
        requests.RequestException: For network/HTTP errors.
    """
    if not WEATHER_API_KEY:
        # Fail loudly rather than leaking a missing-credential error to clients.
        raise RuntimeError("WEATHER_API_KEY environment variable is not set.")

    params = {
        "q": city,
        "units": units,
        "appid": WEATHER_API_KEY,
    }

    # The API key is sent as a query/secret param; never log the full params.
    response = requests.get(
        WEATHER_API_URL,
        params=params,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


@app.route("/weather", methods=["GET"])
def weather():
    city = request.args.get("city", "").strip()
    units = request.args.get("units", "metric").strip()

    if not city:
        return jsonify({"error": "Missing required 'city' parameter."}), 400

    if units not in ("metric", "imperial", "standard"):
        return jsonify({"error": "Invalid 'units' value."}), 400

    try:
        data = fetch_weather(city, units)
    except RuntimeError:
        # Server misconfiguration; do not expose internal details.
        return jsonify({"error": "Weather service is not configured."}), 503
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 502
        # Map upstream errors to generic client messages without leaking the key.
        if status == 404:
            return jsonify({"error": "City not found."}), 404
        return jsonify({"error": "Failed to retrieve weather data."}), 502
    except requests.RequestException:
        return jsonify({"error": "Weather service is unavailable."}), 504

    result = {
        "city": data.get("name"),
        "temperature": data.get("main", {}).get("temp"),
        "humidity": data.get("main", {}).get("humidity"),
        "conditions": [w.get("description") for w in data.get("weather", [])],
    }
    return jsonify(result), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)