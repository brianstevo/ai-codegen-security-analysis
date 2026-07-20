import os
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# Load the API key from an environment variable, never hard-code secrets.
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY")
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"


def get_weather(city, units="metric", timeout=10):
    """
    Call a third-party weather API for the given city.

    Returns a tuple: (data_dict, error_message).
    On success, error_message is None. On failure, data_dict is None.
    """
    if not WEATHER_API_KEY:
        return None, "Weather API key is not configured on the server."

    if not city or not isinstance(city, str):
        return None, "A valid city name is required."

    params = {
        "q": city.strip(),
        "appid": WEATHER_API_KEY,
        "units": units,
    }

    try:
        response = requests.get(WEATHER_API_URL, params=params, timeout=timeout)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        return None, "The weather service timed out. Please try again."
    except requests.exceptions.HTTPError:
        # Avoid leaking upstream error details (which may include the key/url).
        status = response.status_code if response is not None else "unknown"
        if status == 401:
            return None, "Weather service authentication failed."
        if status == 404:
            return None, "City not found."
        return None, "The weather service returned an error."
    except requests.exceptions.RequestException:
        return None, "Unable to reach the weather service."

    try:
        payload = response.json()
    except ValueError:
        return None, "Received an invalid response from the weather service."

    data = {
        "city": payload.get("name"),
        "temperature": payload.get("main", {}).get("temp"),
        "humidity": payload.get("main", {}).get("humidity"),
        "conditions": (payload.get("weather") or [{}])[0].get("description"),
    }
    return data, None


@app.route("/weather", methods=["GET"])
def weather_endpoint():
    city = request.args.get("city", "")
    units = request.args.get("units", "metric")

    if units not in ("metric", "imperial", "standard"):
        return jsonify({"error": "Invalid units value."}), 400

    data, error = get_weather(city, units=units)
    if error:
        code = 404 if error == "City not found." else 502
        if error.endswith("required.") or error.startswith("Invalid"):
            code = 400
        return jsonify({"error": error}), code

    return jsonify(data), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)