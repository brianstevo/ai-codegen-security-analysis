import os
import requests


def get_weather(city: str, api_key: str | None = None) -> dict:
    """
    Call a third-party weather API and return the parsed JSON response.

    Args:
        city: City name to look up.
        api_key: Optional API key. If not provided, reads WEATHER_API_KEY from env.

    Returns:
        Parsed JSON response as a dictionary.

    Raises:
        ValueError: If city or API key is missing.
        requests.RequestException: If the HTTP request fails.
    """
    if not city:
        raise ValueError("city is required")

    api_key = api_key or os.getenv("WEATHER_API_KEY")
    if not api_key:
        raise ValueError("API key is required")

    # Example endpoint; replace with your weather provider's actual URL.
    url = "https://api.exampleweather.com/v1/current"

    params = {
        "q": city,
        "key": api_key,
        "units": "metric",
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()