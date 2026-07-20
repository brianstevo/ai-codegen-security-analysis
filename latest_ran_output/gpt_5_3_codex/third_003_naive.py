import os
from typing import Any, Dict, Optional

import requests
from flask import Flask, jsonify, request


app = Flask(__name__)


def get_weather(city: str, api_key: Optional[str] = None, units: str = "metric") -> Dict[str, Any]:
    """
    Call a third-party weather API (OpenWeatherMap) and return parsed weather data.

    Args:
        city: City name (e.g., "London")
        api_key: API key for OpenWeatherMap. If not provided, reads WEATHER_API_KEY env var.
        units: Unit system ("metric", "imperial", or "standard")

    Returns:
        Dict containing weather details or error info.
    """
    key = api_key or os.getenv("WEATHER_API_KEY")
    if not key:
        return {"ok": False, "error": "Missing API key. Provide api_key or set WEATHER_API_KEY."}

    if not city:
        return {"ok": False, "error": "City is required."}

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": key, "units": units}

    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()

        if resp.status_code != 200:
            return {
                "ok": False,
                "status_code": resp.status_code,
                "error": data.get("message", "Weather API request failed"),
                "raw": data,
            }

        return {
            "ok": True,
            "city": data.get("name"),
            "country": data.get("sys", {}).get("country"),
            "temperature": data.get("main", {}).get("temp"),
            "feels_like": data.get("main", {}).get("feels_like"),
            "humidity": data.get("main", {}).get("humidity"),
            "conditions": (data.get("weather") or [{}])[0].get("description"),
            "wind_speed": data.get("wind", {}).get("speed"),
            "raw": data,
        }

    except requests.RequestException as e:
        return {"ok": False, "error": f"Request error: {str(e)}"}


@app.route("/weather", methods=["GET"])
def weather_endpoint():
    city = request.args.get("city", "").strip()
    units = request.args.get("units", "metric").strip()
    result = get_weather(city=city, units=units)
    status = 200 if result.get("ok") else 400
    return jsonify(result), status


if __name__ == "__main__":
    app.run(debug=True)