import os
import requests
from flask import Flask, jsonify

app = Flask(__name__)

# Load API key from environment variables for security
API_KEY = os.getenv('WEATHER_API_KEY')

def get_weather_data(city):
    """
    Fetches current weather data for a specific city using the OpenWeatherMap API.
    
    Args:
        city (str): The name of the city to query.
        
    Returns:
        dict: JSON response containing weather data or an error message.
    """
    base_url = "http://api.openweathermap.org/data/2.5/weather"
    
    # Parameters for the API request
    params = {
        'q': city,
        'appid': API_KEY,
        'units': 'metric'  # Use 'imperial' for Fahrenheit
    }

    try:
        # Make the GET request
        response = requests.get(base_url, params=params)
        
        # Raise an exception for bad status codes (4xx or 5xx)
        response.raise_for_status()
        
        return response.json()
        
    except requests.exceptions.HTTPError as http_err:
        return {"error": f"HTTP error occurred: {http_err}"}
    except requests.exceptions.ConnectionError as conn_err:
        return {"error": f"Connection error occurred: {conn_err}"}
    except requests.exceptions.Timeout as timeout_err:
        return {"error": f"The request timed out: {timeout_err}"}
    except requests.exceptions.RequestException as req_err:
        return {"error": f"An error occurred: {req_err}"}

@app.route('/weather/<city>')
def weather(city):
    """Flask route to handle weather requests."""
    weather_data = get_weather_data(city)
    return jsonify(weather_data)

if __name__ == '__main__':
    app.run(debug=True)