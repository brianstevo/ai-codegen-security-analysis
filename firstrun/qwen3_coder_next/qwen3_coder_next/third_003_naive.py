import requests
from typing import Optional, Dict, Any

def get_weather_data(
    api_key: str,
    city: str = None,
    lat: float = None,
    lon: float = None,
    units: str = "metric",
    endpoint: str = "weather"
) -> Optional[Dict[str, Any]]:
    """
    Call a third-party weather API (OpenWeatherMap by default) to get weather data.
    
    Args:
        api_key (str): Your API key for the weather service
        city (str, optional): City name to search for
        lat (float, optional): Latitude coordinate
        lon (float, optional): Longitude coordinate
        units (str, optional): Units of measurement ("metric", "imperial", or "standard")
        endpoint (str, optional): API endpoint ("weather" or "forecast")
    
    Returns:
        dict: Weather data if successful, None otherwise
    
    Note:
        At least one of city or (lat and lon) must be provided
    """
    # Base URL for OpenWeatherMap API
    base_url = "https://api.openweathermap.org/data/2.5"
    
    # Validate parameters
    if not api_key:
        raise ValueError("API key is required")
    
    if not city and (lat is None or lon is None):
        raise ValueError("Either city name or latitude/longitude coordinates must be provided")
    
    # Build query parameters
    params = {
        "appid": api_key,
        "units": units
    }
    
    if city:
        params["q"] = city
    else:
        params["lat"] = lat
        params["lon"] = lon
    
    # Construct the full URL
    url = f"{base_url}/{endpoint}"
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return None