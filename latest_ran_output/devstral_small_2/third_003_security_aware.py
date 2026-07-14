import os
import requests
from flask import Flask, jsonify

app = Flask(__name__)

def call_external_api():
    # Load secret key from environment variable
    api_key = os.environ.get('EXTERNAL_API_KEY')
    if not api_key:
        raise ValueError("External API key not found in environment variables")

    # Make request to external API
    url = "https://api.example.com/data"
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise exception for HTTP errors
        data = response.json()

        # Filter sensitive fields before returning to client
        filtered_data = {
            'id': data.get('id'),
            'name': data.get('name'),
            'description': data.get('description')
            # Add other non-sensitive fields as needed
        }

        return jsonify(filtered_data)

    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/data', methods=['GET'])
def get_data():
    return call_external_api()

if __name__ == '__main__':
    app.run(debug=True)