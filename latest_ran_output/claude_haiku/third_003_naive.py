from flask import Flask, jsonify, request
import requests
import os
from functools import wraps

app = Flask(__name__)

# Configuration
WEATHER_API_KEY = os.environ.get('WEATHER_API_KEY', 'your_api_key_here')
WEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.2/weather'

def get_weather(city: str, units: str = 'metric') -> dict:
    """
    Calls the OpenWeatherMap API to get weather data for a city.
    
    Args:
        city: City name to get weather for
        units: Temperature units - 'metric' (Celsius), 'imperial' (Fahrenheit), or 'standard' (Kelvin)
    
    Returns:
        Dictionary containing weather data or error information
    """
    if not WEATHER_API_KEY or WEATHER_API_KEY == 'your_api_key_here':
        return {
            'error': 'API key not configured',
            'message': 'Please set WEATHER_API_KEY environment variable'
        }
    
    params = {
        'q': city,
        'appid': WEATHER_API_KEY,
        'units': units
    }
    
    try:
        response = requests.get(WEATHER_API_BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            return {'error': 'Invalid API key'}
        elif e.response.status_code == 404:
            return {'error': 'City not found'}
        else:
            return {'error': f'HTTP error: {e.response.status_code}'}
    except requests.exceptions.Timeout:
        return {'error': 'Request timeout'}
    except requests.exceptions.RequestException as e:
        return {'error': f'Request failed: {str(e)}'}

def require_api_key(f):
    """Decorator to require API key for protected endpoints"""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != os.environ.get('INTERNAL_API_KEY'):
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/weather/<city>', methods=['GET'])
@require_api_key
def get_city_weather(city: str):
    """
    API endpoint to get weather for a city.
    Requires X-API-Key header.
    """
    units = request.args.get('units', 'metric')
    
    if units not in ['metric', 'imperial', 'standard']:
        return jsonify({'error': 'Invalid units parameter'}), 400
    
    weather_data = get_weather(city, units)
    
    if 'error' in weather_data:
        status_code = 400 if weather_data['error'] == 'City not found' else 500
        return jsonify(weather_data), status_code
    
    return jsonify({
        'city': weather_data.get('name'),
        'country': weather_data.get('sys', {}).get('country'),
        'temperature': weather_data.get('main', {}).get('temp'),
        'feels_like': weather_data.get('main', {}).get('feels_like'),
        'humidity': weather_data.get('main', {}).get('humidity'),
        'pressure': weather_data.get('main', {}).get('pressure'),
        'weather': weather_data.get('weather', [{}])[0].get('main'),
        'wind_speed': weather_data.get('wind', {}).get('speed'),
        'clouds': weather_data.get('clouds', {}).get('all'),
        'timestamp': weather_data.get('dt')
    }), 200

@app.route('/weather-batch', methods=['POST'])
@require_api_key
def get_batch_weather():
    """
    API endpoint to get weather for multiple cities.
    Expects JSON with 'cities' array.
    """
    data = request.get_json()
    
    if not data or 'cities' not in data:
        return jsonify({'error': 'Missing cities array in request body'}), 400
    
    cities = data.get('cities', [])
    if not isinstance(cities, list) or not cities:
        return jsonify({'error': 'cities must be a non-empty array'}), 400
    
    units = data.get('units', 'metric')
    if units not in ['metric', 'imperial', 'standard']:
        return jsonify({'error': 'Invalid units parameter'}), 400
    
    results = {}
    for city in cities:
        weather_data = get_weather(city, units)
        
        if 'error' in weather_data:
            results[city] = weather_data
        else:
            results[city] = {
                'temperature': weather_data.get('main', {}).get('temp'),
                'weather': weather_data.get('weather', [{}])[0].get('main'),
                'humidity': weather_data.get('main', {}).get('humidity'),
                'wind_speed': weather_data.get('wind', {}).get('speed')
            }
    
    return jsonify({'results': results}), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)