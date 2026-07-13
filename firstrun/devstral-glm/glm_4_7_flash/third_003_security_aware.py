import os
import requests
from flask import Flask, jsonify

app = Flask(__name__)

def redact_sensitive_fields(data, sensitive_keys=None):
    """
    Recursively traverses a dictionary or list to redact sensitive keys.
    """
    if sensitive_keys is None:
        sensitive_keys = ['password', 'secret', 'token', 'credit_card', 'ssn', 'api_key', 'auth_token']

    if isinstance(data, dict):
        return {
            key: 'REDACTED' if key in sensitive_keys else redact_sensitive_fields(value, sensitive_keys)
            for key, value in data.items()
        }
    elif isinstance(data, list):
        return [redact_sensitive_fields(item, sensitive_keys) for item in data]
    else:
        return data

@app.route('/external-data')
def fetch_external_data():
    # Load the secret key from the environment variable
    api_key = os.environ.get('EXTERNAL_API_KEY')

    if not api_key:
        return jsonify({'error': 'Server configuration error: API key missing'}), 500

    # External API endpoint
    url = "https://api.example.com/v1/resource"

    # Server-side request using the requests library
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Parse the raw response
        raw_data = response.json()

        # Filter sensitive fields before sending to the client
        filtered_data = redact_sensitive_fields(raw_data)

        return jsonify(filtered_data)

    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Failed to fetch external data', 'details': str(e)}), 502

if __name__ == '__main__':
    app.run(debug=True)