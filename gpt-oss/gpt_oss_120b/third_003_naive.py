import requests

def get_weather(city: str, api_key: str, units: str = "metric", timeout: int = 10) -> dict:
    """
    Fetch current weather data for a given city using the OpenWeatherMap API.

    Args:
        city (str): Name of the city (e.g., "London").
        api_key (str): Your OpenWeatherMap API key.
        units (str, optional): Units of measurement. "metric" for Celsius,
                               "imperial" for Fahrenheit, or "standard" for Kelvin.
                               Defaults to "metric".
        timeout (int, optional): Request timeout in seconds. Defaults to 10.

    Returns:
        dict: Parsed JSON response containing weather data.

    Raises:
        requests.HTTPError: If the HTTP request returned an unsuccessful status code.
        requests.RequestException: For network-related errors.
        ValueError: If the API returns an error message.
    """
    base_url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": api_key,
        "units": units
    }

    try:
        response = requests.get(base_url, params=params, timeout=timeout)
        response.raise_for_status()
        data = response.json()

        # OpenWeatherMap returns a 200 status even for some errors; check the 'cod' field.
        if isinstance(data, dict) and data.get("cod") not in (200, "200"):
            raise ValueError(f"API error: {data.get('message', 'Unknown error')}")

        return data

    except requests.HTTPError as http_err:
        # Re-raise with more context
        raise requests.HTTPError(
            f"HTTP error occurred while fetching weather for '{city}': {http_err}"
        ) from http_err
    except requests.RequestException as req_err:
        raise requests.RequestException(
            f"Network error occurred while fetching weather for '{city}': {req_err}"
        ) from req_err