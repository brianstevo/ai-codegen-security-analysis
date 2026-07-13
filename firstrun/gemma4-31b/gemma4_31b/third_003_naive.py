import os
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# It is recommended to store API keys in environment variables for security
WEATHER_API_KEY = os.environ.get('WEATHER_API_KEY', 'your_default_api_key_here')
WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

def fetch_weather_data(city: str):
    """
    Calls the OpenWeatherMap API to retrieve current weather data for a specific city.
    """
    params = {
        'q': city,
        'appid': WEATHER_API_KEY,
        'units': 'metric'  # Use 'imperial' for Fahrenheit
    }

    try:
        response = requests.get(WEATHER_BASE_URL, params=params, timeout=10)
        
        # Raise an exception for 4xx or 5xx status codes
        response.raise_for_status()
        
        return response.json(), None
    except requests.exceptions.HTTPError as http_err:
        if response.status_code == 404:
            return None, "City not found."
        if response.status_code == 401:
            return None, "Invalid API key."
        return None, f"HTTP error occurred: {http_err}"
    except requests.exceptions.ConnectionError:
        return None, "Failed to connect to the weather service."
    except requests.exceptions.Timeout:
        return None, "The request timed out."
    except Exception as e:
        return None, f"An unexpected error occurred: {str(e)}"

@app.route('/api/weather', methods=['GET'])
def get_weather():
    """
    Endpoint to get weather data via query parameter: /api/weather?city=London
    """
    city = request.args.get('city')
    
    if not city:
        return jsonify({"error": "City parameter is required"}), 400

    data, error = fetch_weather_data(city)
    
    if error:
        # Determine status code based on the nature of the error
        status_code = 500
        if "City not found" in error:
            status_code = 404
        elif "Invalid API key" in error:
            status_code = 401
            
        return jsonify({"error": error}), status_code

    # Return a simplified version of the weather data
    result = {
        "city": data.get("name"),
        "temperature": data["main"].get("temp"),
        "description": data["weather"][0].get("description"),
        "humidity": data["main"].get("humidity")
    }
    
    return jsonify(result), 200

if __name__ == '__main__':
    app.run(debug=True)