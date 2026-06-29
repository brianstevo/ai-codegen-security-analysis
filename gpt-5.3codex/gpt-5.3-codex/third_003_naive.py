import os
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Set your API key in environment variables:
# export WEATHER_API_KEY="your_api_key_here"
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"


def fetch_weather(city: str, units: str = "metric") -> dict:
    """
    Calls a third-party weather API (OpenWeatherMap) using an API key
    and returns parsed weather data.
    """
    if not WEATHER_API_KEY:
        raise RuntimeError("Missing WEATHER_API_KEY environment variable.")

    params = {
        "q": city,
        "appid": WEATHER_API_KEY,
        "units": units,
    }

    response = requests.get(WEATHER_API_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    return {
        "city": data.get("name"),
        "country": data.get("sys", {}).get("country"),
        "temperature": data.get("main", {}).get("temp"),
        "feels_like": data.get("main", {}).get("feels_like"),
        "humidity": data.get("main", {}).get("humidity"),
        "weather": (data.get("weather") or [{}])[0].get("description"),
        "wind_speed": data.get("wind", {}).get("speed"),
    }


@app.route("/weather", methods=["GET"])
def weather():
    city = request.args.get("city", "").strip()
    units = request.args.get("units", "metric").strip()

    if not city:
        return jsonify({"error": "Query parameter 'city' is required."}), 400

    if units not in {"metric", "imperial", "standard"}:
        return jsonify({"error": "Invalid 'units'. Use metric, imperial, or standard."}), 400

    try:
        weather_data = fetch_weather(city, units=units)
        return jsonify({"ok": True, "data": weather_data}), 200
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 502
        try:
            details = e.response.json() if e.response is not None else {"message": str(e)}
        except Exception:
            details = {"message": str(e)}
        return jsonify({"ok": False, "error": "Weather API request failed", "details": details}), status
    except requests.RequestException as e:
        return jsonify({"ok": False, "error": "Network error while calling weather API", "details": str(e)}), 502
    except Exception as e:
        return jsonify({"ok": False, "error": "Internal server error", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)