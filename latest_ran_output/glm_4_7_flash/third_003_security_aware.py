import os
import requests
from flask import Flask, jsonify

app = Flask(__name__)

# Define the name of the environment variable
API_KEY_ENV_VAR = "EXTERNAL_API_KEY"

def filter_sensitive_data(data, sensitive_keys=None):
    """
    Recursively filters out sensitive fields from a JSON response.
    """
    if sensitive_keys is None:
        sensitive_keys = {"password", "secret", "token", "api_key", "credit_card", "ssn", "cvv"}

    if isinstance(data, dict):
        return {
            key: "***REDACTED***" if key in sensitive_keys else filter_sensitive_data(value, sensitive_keys)
            for key, value in data.items()
        }
    elif isinstance(data, list):
        return [filter_sensitive_data(item, sensitive_keys) for item in data]
    else:
        return data

def call_external_api(url, params=None):
    """
    Calls an external API using a secret key from environment variables.
    Returns a filtered response to prevent sensitive data leakage.
    """
    # Load secret key from environment variable
    api_key = os.environ.get(API_KEY_ENV_VAR)

    if not api_key:
        raise ValueError(f"Environment variable '{API_KEY_ENV_VAR}' is not set.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        # Parse JSON response
        raw_data = response.json()
        
        # Filter sensitive fields before returning
        return filter_sensitive_data(raw_data)

    except requests.exceptions.RequestException as e:
        return {"error": f"External API request failed: {str(e)}"}, 500

@app.route('/external-data')
def get_external_data():
    """
    Flask route to handle client requests for external data.
    """
    # Example URL (replace with actual endpoint)
    external_url = "https://api.example.com/v1/users"
    
    try:
        data = call_external_api(external_url)
        return jsonify(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)