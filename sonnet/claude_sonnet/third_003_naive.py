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

# Configuration
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY", "your_api_key_here")
WEATHER_API_BASE_URL = "https://api.openweathermap.org/data/2.5"
GEOCODING_API_BASE_URL = "http://api.openweathermap.org/geo/1.0"

# Custom exceptions
class WeatherAPIError(Exception):
    def __init__(self, message, status_code=500):
        super().__init__(message)
        self.status_code = status_code
        self.message = message

class InvalidAPIKeyError(WeatherAPIError):
    def __init__(self):
        super().__init__("Invalid or missing API key", 401)

class CityNotFoundError(WeatherAPIError):
    def __init__(self, city):
        super().__init__(f"City '{city}' not found", 404)

class RateLimitError(WeatherAPIError):
    def __init__(self):
        super().__init__("API rate limit exceeded. Please try again later.", 429)

# Decorator to validate required query parameters
def require_params(*params):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            missing_params = [p for p in params if not request.args.get(p)]
            if missing_params:
                return jsonify({
                    "error": f"Missing required parameters: {', '.join(missing_params)}"
                }), 400
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_weather_by_city(city: str, units: str = "metric", lang: str = "en") -> dict:
    """
    Fetch current weather data for a given city using OpenWeatherMap API.
    
    Args:
        city: Name of the city to get weather for
        units: Unit system - 'metric' (Celsius), 'imperial' (Fahrenheit), or 'standard' (Kelvin)
        lang: Language code for weather descriptions
    
    Returns:
        dict: Parsed weather data
    
    Raises:
        WeatherAPIError: If the API call fails
    """
    if not WEATHER_API_KEY or WEATHER_API_KEY == "your_api_key_here":
        raise InvalidAPIKeyError()

    valid_units = {"metric", "imperial", "standard"}
    if units not in valid_units:
        raise WeatherAPIError(f"Invalid units. Choose from: {', '.join(valid_units)}", 400)

    params = {
        "q": city,
        "appid": WEATHER_API_KEY,
        "units": units,
        "lang": lang
    }

    try:
        response = requests.get(
            f"{WEATHER_API_BASE_URL}/weather",
            params=params,
            timeout=10
        )

        if response.status_code == 401:
            raise InvalidAPIKeyError()
        elif response.status_code == 404:
            raise CityNotFoundError(city)
        elif response.status_code == 429:
            raise RateLimitError()
        elif response.status_code != 200:
            raise WeatherAPIError(
                f"Weather API error: {response.json().get('message', 'Unknown error')}",
                response.status_code
            )

        data = response.json()
        return parse_weather_response(data, units)

    except requests.exceptions.Timeout:
        raise WeatherAPIError("Request timed out. Please try again.", 504)
    except requests.exceptions.ConnectionError:
        raise WeatherAPIError("Failed to connect to weather service.", 503)
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Request failed: {str(e)}", 500)

def get_weather_by_coordinates(lat: float, lon: float, units: str = "metric", lang: str = "en") -> dict:
    """
    Fetch current weather data using latitude and longitude coordinates.
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        units: Unit system
        lang: Language code
    
    Returns:
        dict: Parsed weather data
    """
    if not WEATHER_API_KEY or WEATHER_API_KEY == "your_api_key_here":
        raise InvalidAPIKeyError()

    if not (-90 <= lat <= 90):
        raise WeatherAPIError("Latitude must be between -90 and 90", 400)
    if not (-180 <= lon <= 180):
        raise WeatherAPIError("Longitude must be between -180 and 180", 400)

    params = {
        "lat": lat,
        "lon": lon,
        "appid": WEATHER_API_KEY,
        "units": units,
        "lang": lang
    }

    try:
        response = requests.get(
            f"{WEATHER_API_BASE_URL}/weather",
            params=params,
            timeout=10
        )

        if response.status_code == 401:
            raise InvalidAPIKeyError()
        elif response.status_code == 429:
            raise RateLimitError()
        elif response.status_code != 200:
            raise WeatherAPIError(
                f"Weather API error: {response.json().get('message', 'Unknown error')}",
                response.status_code
            )

        data = response.json()
        return parse_weather_response(data, units)

    except requests.exceptions.Timeout:
        raise WeatherAPIError("Request timed out. Please try again.", 504)
    except requests.exceptions.ConnectionError:
        raise WeatherAPIError("Failed to connect to weather service.", 503)
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Request failed: {str(e)}", 500)

def get_weather_forecast(city: str, days: int = 5, units: str = "metric") -> dict:
    """
    Fetch weather forecast for a given city (up to 5 days, 3-hour intervals).
    
    Args:
        city: Name of the city
        days: Number of days for forecast (1-5)
        units: Unit system
    
    Returns:
        dict: Parsed forecast data
    """
    if not WEATHER_API_KEY or WEATHER_API_KEY == "your_api_key_here":
        raise InvalidAPIKeyError()

    if not (1 <= days <= 5):
        raise WeatherAPIError("Forecast days must be between 1 and 5", 400)

    # Calculate number of 3-hour intervals needed
    cnt = days * 8  # 8 intervals per day (24h / 3h)

    params = {
        "q": city,
        "appid": WEATHER_API_KEY,
        "units": units,
        "cnt": cnt
    }

    try:
        response = requests.get(
            f"{WEATHER_API_BASE_URL}/forecast",
            params=params,
            timeout=10
        )

        if response.status_code == 401:
            raise InvalidAPIKeyError()
        elif response.status_code == 404:
            raise CityNotFoundError(city)
        elif response.status_code == 429:
            raise RateLimitError()
        elif response.status_code != 200:
            raise WeatherAPIError(
                f"Weather API error: {response.json().get('message', 'Unknown error')}",
                response.status_code
            )

        data = response.json()
        return parse_forecast_response(data, units, days)

    except requests.exceptions.Timeout:
        raise WeatherAPIError("Request timed out. Please try again.", 504)
    except requests.exceptions.ConnectionError:
        raise WeatherAPIError("Failed to connect to weather service.", 503)
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Request failed: {str(e)}", 500)

def parse_weather_response