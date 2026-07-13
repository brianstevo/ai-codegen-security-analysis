import requests


def get_weather_data(api_key: str, city: str = "London", units: str = "metric") -> dict:
    """
    Fetches current weather data from OpenWeatherMap API.

    Args:
        api_key (str): The API key for OpenWeatherMap.
        city (str): The name of the city to get weather for. Defaults to "London".
        units (str): Units of measurement ('metric', 'imperial', or 'standard'). Defaults to "metric".

    Returns:
        dict: A dictionary containing the weather data.
              If an error occurs, returns a dictionary with an 'error' key.
    """
    base_url = "http://api.openweathermap.org/data/2.5/weather"
    
    params = {
        "q": city,
        "appid": api_key,
        "units": units
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.HTTPError as http_err:
        return {"error": f"HTTP error occurred: {http_err}"}
    except requests.exceptions.ConnectionError:
        return {"error": "Error in connecting to the API"}
    except requests.exceptions.Timeout:
        return {"error": "Timeout error occurred"}
    except requests.exceptions.RequestException as err:
        return {"error": f"An error occurred: {err}"}