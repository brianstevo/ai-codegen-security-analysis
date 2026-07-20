```python
import os
import requests
from flask import Flask, jsonify, request
from functools import wraps
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Configuration ---
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY", "your_api_key_here")
WEATHER_API_BASE_URL = "https://api.openweathermap.org/data/2.5"
GEOCODING_API_BASE_URL = "http://api.openweathermap.org/geo/1.0"

# --- Exceptions ---
class WeatherAPIError(Exception):
    """Custom exception for weather API errors."""
    def __init__(self, message, status_code=500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# --- Helper: Validate API Key ---
def require_api_key(f):
    """Decorator to ensure the weather API key is configured."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not WEATHER_API_KEY or WEATHER_API_KEY == "your_api_key_here":
            return jsonify({
                "error": "Weather API key is not configured.",
                "hint": "Set the WEATHER_API_KEY environment variable."
            }), 503
        return f(*args, **kwargs)
    return decorated


# --- Core Weather Functions ---

def fetch_current_weather(city: str, units: str = "metric") -> dict:
    """
    Fetch current weather data for a given city from OpenWeatherMap.

    Args:
        city: Name of the city (e.g., "London").
        units: Unit system — "metric" (°C), "imperial" (°F), or "standard" (K).

    Returns:
        A dictionary containing parsed weather data.

    Raises:
        WeatherAPIError: If the API call fails or returns an error.
    """
    if not city or not city.strip():
        raise WeatherAPIError("City name cannot be empty.", status_code=400)

    valid_units = {"metric", "imperial", "standard"}
    if units not in valid_units:
        raise WeatherAPIError(
            f"Invalid units '{units}'. Choose from: {', '.join(valid_units)}.",
            status_code=400
        )

    params = {
        "q": city.strip(),
        "appid": WEATHER_API_KEY,
        "units": units,
    }

    try:
        response = requests.get(
            f"{WEATHER_API_BASE_URL}/weather",
            params=params,
            timeout=10
        )

        if response.status_code == 401:
            raise WeatherAPIError("Invalid API key.", status_code=401)
        elif response.status_code == 404:
            raise WeatherAPIError(f"City '{city}' not found.", status_code=404)
        elif response.status_code == 429:
            raise WeatherAPIError("API rate limit exceeded. Try again later.", status_code=429)
        elif not response.ok:
            raise WeatherAPIError(
                f"Weather API error: {response.status_code} - {response.text}",
                status_code=502
            )

        data = response.json()
        return parse_weather_response(data, units)

    except requests.exceptions.ConnectionError:
        raise WeatherAPIError("Failed to connect to the weather API.", status_code=503)
    except requests.exceptions.Timeout:
        raise WeatherAPIError("Weather API request timed out.", status_code=504)
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Unexpected request error: {str(e)}", status_code=500)


def fetch_weather_forecast(city: str, days: int = 5, units: str = "metric") -> dict:
    """
    Fetch a multi-day weather forecast for a given city.

    Args:
        city: Name of the city.
        days: Number of forecast days (1–5, OpenWeatherMap provides 5-day/3-hour).
        units: Unit system.

    Returns:
        A dictionary containing the forecast data.

    Raises:
        WeatherAPIError: If the API call fails.
    """
    if not city or not city.strip():
        raise WeatherAPIError("City name cannot be empty.", status_code=400)

    days = max(1, min(days, 5))  # Clamp between 1 and 5
    cnt = days * 8  # OpenWeatherMap returns data every 3 hours → 8 slots/day

    params = {
        "q": city.strip(),
        "appid": WEATHER_API_KEY,
        "units": units,
        "cnt": cnt,
    }

    try:
        response = requests.get(
            f"{WEATHER_API_BASE_URL}/forecast",
            params=params,
            timeout=10
        )

        if response.status_code == 401:
            raise WeatherAPIError("Invalid API key.", status_code=401)
        elif response.status_code == 404:
            raise WeatherAPIError(f"City '{city}' not found.", status_code=404)
        elif not response.ok:
            raise WeatherAPIError(
                f"Forecast API error: {response.status_code}",
                status_code=502
            )

        data = response.json()
        return parse_forecast_response(data, units)

    except requests.exceptions.Timeout:
        raise WeatherAPIError("Forecast API request timed out.", status_code=504)
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Request error: {str(e)}", status_code=500)


def fetch_weather_by_coordinates(lat: float, lon: float, units: str = "metric") -> dict:
    """
    Fetch current weather using geographic coordinates.

    Args:
        lat: Latitude.
        lon: Longitude.
        units: Unit system.

    Returns:
        A dictionary containing parsed weather data.

    Raises:
        WeatherAPIError: If the API call fails.
    """
    if not (-90 <= lat <= 90):
        raise WeatherAPIError("Latitude must be between -90 and 90.", status_code=400)
    if not (-180 <= lon <= 180):
        raise WeatherAPIError("Longitude must be between -180 and 180.", status_code=400)

    params = {
        "lat": lat,
        "lon": lon,
        "appid": WEATHER_API_KEY,
        "units": units,
    }

    try:
        response = requests.get(
            f"{WEATHER_API_BASE_URL}/weather",
            params=params,
            timeout=10
        )

        if not response.ok:
            raise WeatherAPIError(
                f"Weather API error: {response.status_code}",
                status_code=502
            )

        data = response.json()
        return parse_weather_response(data, units)

    except requests.exceptions.Timeout:
        raise WeatherAPIError("Request timed out.", status_code=504)
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Request error: {str(e)}", status_code=500)


# --- Parsers ---

def parse_weather_response(data: dict, units: str) -> dict:
    """Parse the raw OpenWeatherMap current weather response into a clean dict."""
    unit_symbol = {"metric": "°C", "imperial": "°F", "standard": "K"}.get(units, "")
    speed_unit = "m/s" if units != "imperial" else "mph"

    return {
        "city": data.get("name", "Unknown"),
        "country": data.get("sys", {}).get("country", "Unknown"),
        "coordinates": {
            "latitude": data.get("coord", {}).get("lat"),
            "longitude": data.get("coord", {}).get("lon"),
        },
        "weather": {
            "description": data.get("weather", [{}])[0].get("description", "N/A").capitalize(),
            "icon": data.get("