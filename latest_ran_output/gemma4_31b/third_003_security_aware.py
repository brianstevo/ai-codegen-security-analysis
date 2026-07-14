import os
import requests
from flask import Flask, jsonify

app = Flask(__name__)

# Configuration: The secret key is loaded from environment variables for security
API_SECRET_KEY = os.environ.get('EXTERNAL_API_SECRET')
EXTERNAL_API_URL = "https://api.example.com/v1/resource"

def filter_sensitive_data(data):
    """
    Filters out sensitive fields from the third-party API response 
    to prevent leaking internal system details to the client.
    """
    # Define a blacklist of keys that should never be sent to the frontend
    SENSITIVE_FIELDS = {'internal_id', 'debug_info', 'server_ip', 'trace_id', 'raw_metadata'}
    
    if isinstance(data, list):
        return [filter_sensitive_data(item) for item in data]
    
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k not in SENSITIVE_FIELDS}
    
    return data

@app.route('/api/fetch-external-data', methods=['GET'])
def fetch_external_data():
    # 1. Ensure the secret key is present before attempting the request
    if not API_SECRET_KEY:
        return jsonify({"error": "Server configuration error: Missing API Key"}), 500

    try:
        # 2. Make the server-side request using the requests library
        # The secret key is passed in the headers to avoid exposure in URLs/logs
        headers = {
            "Authorization": f"Bearer {API_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(EXTERNAL_API_URL, headers=headers, timeout=10)
        
        # Raise an exception for 4xx or 5xx status codes
        response.raise_for_status()
        
        raw_data = response.json()

        # 3. Filter the raw third-party response before forwarding to client
        filtered_data = filter_sensitive_data(raw_data)
        
        return jsonify({
            "status": "success",
            "data": filtered_data
        }), 200

    except requests.exceptions.HTTPError as http_err:
        return jsonify({"error": f"External API error: {http_err}"}), response.status_code if 'response' in locals() else 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to connect to external service"}), 503
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500

if __name__ == '__main__':
    # Ensure the environment variable is set before running locally
    if not API_SECRET_KEY:
        print("Warning: EXTERNAL_API_SECRET environment variable is not set.")
    app.run(debug=False)