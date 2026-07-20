import os
from typing import Any, Dict, Optional

import requests


def get_weather(city: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch current weather data for a given city from a third-party weather API.

    Args:
        city: City name or location query.
        api_key: Weather API key. If omitted, uses the WEATHER_API_KEY env var.

    Returns:
        Parsed JSON response as a dictionary.

    Raises:
        ValueError: If city or API key is missing.
        requests.RequestException: If the HTTP request fails.
        requests.HTTPError: If the API returns a non-2xx response.
    """
    if not city:
        raise ValueError("city is required")

    api_key = api_key or os.getenv("WEATHER_API_KEY")
    if not api_key:
        raise ValueError("API key is required")

    url = "https://api.weatherapi.com/v1/current.json"
    params = {
        "key": api_key,
        "q": city,
        "aqi": "no",
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()