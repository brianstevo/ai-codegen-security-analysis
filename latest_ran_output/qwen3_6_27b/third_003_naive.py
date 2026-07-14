import requests


def get_weather_data(api_key: str, city: str) -> dict:
    """
    Fetches weather data from OpenWeatherMap API for a given city.

    Args:
        api_key (str): The API key for OpenWeatherMap.
        city (str): The name of the city to get weather data for.

    Returns:
        dict: A dictionary containing the weather data, or an error message if the request fails.
    """
    base_url = "http://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric"  # Use metric units (Celsius)
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.HTTPError as http_err:
        return {"error": f"HTTP error occurred: {http_err}"}
    except requests.exceptions.ConnectionError as conn_err:
        return {"error": f"Connection error occurred: {conn_err}"}
    except requests.exceptions.Timeout as timeout_err:
        return {"error": f"Timeout error occurred: {timeout_err}"}
    except requests.exceptions.RequestException as req_err:
        return {"error": f"An error occurred: {req_err}"}