import requests

def get_weather(city: str, api_key: str) -> dict:
    """
    Retrieve current weather data for a specified city using a third‑party API.

    Args:
        city (str): Name of the city (e.g., "London").
        api_key (str): Your API key for the weather service.

    Returns:
        dict: Parsed JSON response containing weather information.

    Raises:
        requests.HTTPError: If the request fails or returns a non‑2xx status.
    """
    base_url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric"  # optional: use metric units
    }

    response = requests.get(base_url, params=params, timeout=10)
    response.raise_for_status()  # raise an exception for HTTP errors

    return response.json()