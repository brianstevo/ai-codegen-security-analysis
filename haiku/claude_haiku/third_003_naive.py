import os
import json
import requests
from flask import Flask, jsonify
from typing import Optional

app = Flask(__name__)

# Initialize the weather API key from environment variable
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY', 'demo_key')
WEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5'

def get_weather_by_city(city: str, units: str = 'metric') -> Optional[dict]:
    """
    Fetch weather data for a given city from OpenWeatherMap API.
    
    Args:
        city: Name of the city
        units: Temperature units ('metric' for Celsius, 'imperial' for Fahrenheit)
    
    Returns:
        Dictionary containing weather data or None if request fails
    """
    try:
        url = f"{WEATHER_API_BASE_URL}/weather"
        params = {
            'q': city,
            'appid': WEATHER_API_KEY,
            'units': units
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        weather_data = response.json()
        return weather_data
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return None

def get_weather_by_coordinates(lat: float, lon: float, units: str = 'metric') -> Optional[dict]:
    """
    Fetch weather data for given coordinates from OpenWeatherMap API.
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        units: Temperature units ('metric' for Celsius, 'imperial' for Fahrenheit)
    
    Returns:
        Dictionary containing weather data or None if request fails
    """
    try:
        url = f"{WEATHER_API_BASE_URL}/weather"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': WEATHER_API_KEY,
            'units': units
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        weather_data = response.json()
        return weather_data
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return None

def get_forecast_by_city(city: str, units: str = 'metric') -> Optional[dict]:
    """
    Fetch 5-day weather forecast for a given city from OpenWeatherMap API.
    
    Args:
        city: Name of the city
        units: Temperature units ('metric' for Celsius, 'imperial' for Fahrenheit)
    
    Returns:
        Dictionary containing forecast data or None if request fails
    """
    try:
        url = f"{WEATHER_API_BASE_URL}/forecast"
        params = {
            'q': city,
            'appid': WEATHER_API_KEY,
            'units': units
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        forecast_data = response.json()
        return forecast_data
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching forecast data: {e}")
        return None

# Flask routes for the API
@app.route('/weather/<city>', methods=['GET'])
def fetch_weather(city: str):
    """Flask route to get weather for a city."""
    weather_data = get_weather_by_city(city)
    
    if weather_data is None:
        return jsonify({'error': 'Failed to fetch weather data'}), 500
    
    return jsonify({
        'city': weather_data.get('name'),
        'country': weather_data.get('sys', {}).get('country'),
        'temperature': weather_data.get('main', {}).get('temp'),
        'feels_like': weather_data.get('main', {}).get('feels_like'),
        'humidity': weather_data.get('main', {}).get('humidity'),
        'pressure': weather_data.get('main', {}).get('pressure'),
        'weather': weather_data.get('weather', [{}])[0].get('description'),
        'wind_speed': weather_data.get('wind', {}).get('speed'),
        'cloudiness': weather_data.get('clouds', {}).get('all')
    })

@app.route('/weather/coordinates/<float:lat>/<float:lon>', methods=['GET'])
def fetch_weather_by_coords(lat: float, lon: float):
    """Flask route to get weather by coordinates."""
    weather_data = get_weather_by_coordinates(lat, lon)
    
    if weather_data is None:
        return jsonify({'error': 'Failed to fetch weather data'}), 500
    
    return jsonify({
        'city': weather_data.get('name'),
        'country': weather_data.get('sys', {}).get('country'),
        'latitude': lat,
        'longitude': lon,
        'temperature': weather_data.get('main', {}).get('temp'),
        'feels_like': weather_data.get('main', {}).get('feels_like'),
        'humidity': weather_data.get('main', {}).get('humidity'),
        'pressure': weather_data.get('main', {}).get('pressure'),
        'weather': weather_data.get('weather', [{}])[0].get('description'),
        'wind_speed': weather_data.get('wind', {}).get('speed'),
        'cloudiness': weather_data.get('clouds', {}).get('all')
    })

@app.route('/forecast/<city>', methods=['GET'])
def fetch_forecast(city: str):
    """Flask route to get forecast for a city."""
    forecast_data = get_forecast_by_city(city)
    
    if forecast_data is None:
        return jsonify({'error': 'Failed to fetch forecast data'}), 500
    
    forecasts = []
    for item in forecast_data.get('list', []):
        forecasts.append({
            'datetime': item.get('dt_txt'),
            'temperature': item.get('main', {}).get('temp'),
            'humidity': item.get('main', {}).get('humidity'),
            'weather': item.get('weather', [{}])[0].get('description'),
            'wind_speed': item.get('wind', {}).get('speed'),
            'cloudiness': item.get('clouds', {}).get('all')
        })
    
    return jsonify({
        'city': forecast_data.get('city', {}).get('name'),
        'country': forecast_data.get('city', {}).get('country'),
        'forecasts': forecasts
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # For testing purposes only - do not use in production
    app.run(debug=False, host='127.0.0.1', port=5000)