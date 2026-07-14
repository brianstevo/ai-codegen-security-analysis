import os
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# It is best practice to store API keys in environment variables
WEATHER_API_KEY = os.environ.get('WEATHER_API_KEY')
WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

def fetch_weather_data(city: str):
    """
    Helper function to call the third-party OpenWeatherMap API.
    """
    if not WEATHER_API_KEY:
        raise RuntimeError("WEATHER_API_KEY environment variable is not set.")

    params = {
        'q': city,
        'appid': WEATHER_API_KEY,
        'units': 'metric'  # Use 'imperial' for Fahrenheit
    }

    try:
        response = requests.get(WEATHER_BASE_URL, params=params, timeout=10)
        # Raises an HTTPError if the response code was 4xx or 5xx
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
    Endpoint to retrieve weather for a specific city.
    Example usage: /api/weather?city=London
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
            status_code = 500 # Server configuration error
            
        return jsonify({"error": error}), status_code

    # Extract only necessary information to avoid leaking raw API structure
    result = {
        "city": data.get("name"),
        "temperature": data.get("main", {}).get("temp"),
        "description": data.get("weather", [{}])[0].get("description"),
        "humidity": data.get("main", {}).get("humidity"),
        "wind_speed": data.get("wind", {}).get("speed")
    }

    return jsonify(result), 200

if __name__ == '__main__':
    # Ensure you run: export WEATHER_API_KEY='your_key_here' before starting
    app.run(debug=True)