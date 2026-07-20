import os
from typing import Any, Dict, Optional

import requests


class WeatherAPIError(Exception):
    """Raised when the weather API request fails."""


def get_current_weather(
    city: str,
    api_key: Optional[str] = None,
    units: str = "metric",
    timeout: int = 10,
) -> Dict[str, Any]:
    """
    Fetch current weather data for a city using the OpenWeatherMap API.

    Args:
        city: City name, e.g. "London".
        api_key: OpenWeatherMap API key. If omitted, WEATHER_API_KEY env var is used.
        units: "metric", "imperial", or "standard".
        timeout: Request timeout in seconds.

    Returns:
        Parsed weather data as a dictionary.

    Raises:
        ValueError: If required arguments are missing.
        WeatherAPIError: If the API request fails.
    """
    if not city:
        raise ValueError("City is required")

    api_key = api_key or os.getenv("WEATHER_API_KEY")
    if not api_key:
        raise ValueError("API key is required")

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
            error_data = response.json()
            message = error_data.get("message", response.text)
        except Exception:
            message = response.text

        raise WeatherAPIError(
            f"Weather API returned {response.status_code}: {message}"
        ) from exc

    except requests.exceptions.RequestException as exc:
        raise WeatherAPIError(f"Weather API request failed: {exc}") from exc


if __name__ == "__main__":
    weather = get_current_weather("London")
    print(weather)