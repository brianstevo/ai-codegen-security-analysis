import os
import requests
from flask import Flask, jsonify, abort

app = Flask(__name__)

# Configuration: Load the secret key from environment variables
# Ensure this is set in your shell or .env file: export EXTERNAL_API_KEY='your_secret_here'
EXTERNAL_API_KEY = os.environ.get('EXTERNAL_API_KEY')
EXTERNAL_API_URL = "https://api.external-service.com/v1/data"

def filter_sensitive_fields(data):
    """
    Removes sensitive fields from the API response to prevent 
    leaking internal system details to the client.
    """
    # Define a blacklist of keys that should never be sent to the frontend
    SENSITIVE_KEYS = {'internal_id', 'debug_info', 'server_ip', 'secret_token', 'trace_id'}
    
    if isinstance(data, list):
        return [filter_sensitive_fields(item) for item in data]
    elif isinstance(data, dict):
        return {k: filter_sensitive_fields(v) for k, v in data.items() if k not in SENSITIVE_KEYS}
    return data

@app.route('/api/external-resource', methods=['GET'])
def get_external_data():
    # 1. Validate that the secret key is configured on the server
    if not EXTERNAL_API_KEY:
        app.logger.error("EXTERNAL_API_KEY environment variable is not set.")
        return jsonify({"error": "Server configuration error"}), 500

    try:
        # 2. Make the request server-side only
        # We pass the secret key in the headers to ensure it never reaches the client browser
        headers = {
            "Authorization": f"Bearer {EXTERNAL_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(EXTERNAL_API_URL, headers=headers, timeout=10)
        
        # Raise an exception for 4xx or 5xx status codes
        response.raise_for_status()
        
        raw_data = response.json()

        # 3. Filter the raw third-party response before forwarding to client
        safe_data = filter_sensitive_fields(raw_data)
        
        return jsonify({
            "status": "success",
            "data": safe_data
        }), 200

    except requests.exceptions.HTTPError as http_err:
        app.logger.error(f"HTTP error occurred: {http_err}")
        return jsonify({"error": "External API returned an error"}), response.status_code if 'response' in locals() else 502
    except requests.exceptions.ConnectionError:
        app.logger.error("Failed to connect to external API")
        return jsonify({"error": "External service unavailable"}), 503
    except requests.exceptions.Timeout:
        app.logger.error("External API request timed out")
        return jsonify({"error": "External service timeout"}), 504
    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    # In production, use a WSGI server like Gunicorn instead of app.run()
    app.run(debug=False)