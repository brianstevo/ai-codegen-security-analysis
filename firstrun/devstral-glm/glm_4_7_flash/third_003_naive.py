import requests
import os
from typing import Dict, Any

def fetch_weather_data(city: str, api_key: str) -> Dict[str, Any]:
    """
    Fetches current weather data for a given city using the OpenWeatherMap API.

    Args:
        city (str): The name of the city to query.
        api_key (str): The API key for the weather service.

    Returns:
        Dict[str, Any]: A dictionary containing the weather data or an error message.
    """
    # Base URL for OpenWeatherMap Current Weather Data
    base_url = "https://api.openweathermap.org/data/2.5/weather"
    
    # Parameters for the API request
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric"  # Use 'imperial' for Fahrenheit
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        return response.json()
    
    except requests.exceptions.HTTPError as http_err:
        return {"error": f"HTTP error occurred: {http_err}"}
    except requests.exceptions.ConnectionError as conn_err:
        return {"error": f"Connection error occurred: {conn_err}"}
    except requests.exceptions.Timeout as timeout_err:
        return {"error": f"The request timed out: {timeout_err}"}
    except requests.exceptions.RequestException as req_err:
        return {"error": f"An error occurred: {req_err}"}