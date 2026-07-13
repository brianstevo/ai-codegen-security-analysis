import os
from typing import Any, Dict, Optional

import requests


class WeatherAPIError(Exception):
    """Raised when the weather API request fails."""


def get_weather(
    city: str,
    api_key: Optional[str] = None,
    units: str = "metric",
    timeout: int = 10,
) -> Dict[str, Any]:
    """
    Fetch current weather data for a city using the OpenWeatherMap API.

    Args:
        city: City name, e.g. "London".
        api_key: OpenWeatherMap API key. If not provided, reads WEATHER_API_KEY.
        units: "metric", "imperial", or "standard".
        timeout: Request timeout in seconds.

    Returns:
        Parsed JSON weather data as a dictionary.

    Raises:
        ValueError: If required inputs are missing.
        WeatherAPIError: If the API request fails.
    """
    if not city:
        raise ValueError("City is required")

    api_key = api_key or os.getenv("WEATHER_API_KEY")
    if not api_key:
        raise ValueError("Weather API key is required")

    url = "https://api.openweathermap.org/data/2.5/weather"

    params = {
        "q": city,
        "appid": api_key,
        "units": units,
    }

    try:
        response = requests.get(url, params=params, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as exc:
        try:
            error_detail = response.json()
        except ValueError:
            error_detail = response.text
        raise WeatherAPIError(f"Weather API HTTP error: {error_detail}") from exc
    except requests.exceptions.RequestException as exc:
        raise WeatherAPIError(f"Weather API request failed: {exc}") from exc