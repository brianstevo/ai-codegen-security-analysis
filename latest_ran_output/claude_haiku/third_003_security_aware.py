import os
import json
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

EXTERNAL_API_KEY = os.environ.get('EXTERNAL_API_KEY')
EXTERNAL_API_URL = os.environ.get('EXTERNAL_API_URL', 'https://api.example.com')

SENSITIVE_FIELDS = ['api_key', 'secret', 'password', 'token', 'private_key', 'auth_token']

def filter_sensitive_fields(data):
    """
    Recursively filters out sensitive fields from the API response.
    Returns a cleaned version safe to send to the client.
    """
    if isinstance(data, dict):
        filtered = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
                filtered[key] = "[REDACTED]"
            elif isinstance(value, (dict, list)):
                filtered[key] = filter_sensitive_fields(value)
            else:
                filtered[key] = value
        return filtered
    elif isinstance(data, list):
        return [filter_sensitive_fields(item) if isinstance(item, (dict, list)) else item for item in data]
    else:
        return data

def call_external_api(endpoint, method='GET', params=None, data=None):
    """
    Call an external API with the secret key from environment.
    Only called server-side, never exposes raw response to client.
    
    Args:
        endpoint: The API endpoint to call
        method: HTTP method (GET, POST, etc.)
        params: Query parameters
        data: Request body data
    
    Returns:
        Filtered response safe for client consumption
    """
    if not EXTERNAL_API_KEY:
        raise ValueError("EXTERNAL_API_KEY environment variable not set")
    
    headers = {
        'Authorization': f'Bearer {EXTERNAL_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    url = f"{EXTERNAL_API_URL}/{endpoint}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method.upper() == 'POST':
            response = requests.post(url, headers=headers, json=data, params=params, timeout=10)
        elif method.upper() == 'PUT':
            response = requests.put(url, headers=headers, json=data, params=params, timeout=10)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=headers, params=params, timeout=10)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        
        raw_response = response.json()
        
        filtered_response = filter_sensitive_fields(raw_response)
        
        return filtered_response
        
    except requests.exceptions.RequestException as e:
        error_message = str(e)
        return {
            'error': 'Failed to call external API',
            'details': error_message
        }

@app.route('/api/external-data', methods=['GET'])
def get_external_data():
    """
    Example endpoint that calls external API server-side.
    Only filtered response is sent to client.
    """
    try:
        endpoint = request.args.get('endpoint', 'data')
        filtered_data = call_external_api(endpoint)
        return jsonify(filtered_data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fetch-user/<user_id>', methods=['GET'])
def fetch_user_data(user_id):
    """
    Example endpoint that fetches user data from external API.
    """
    try:
        filtered_data = call_external_api(f'users/{user_id}')
        return jsonify(filtered_data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-resource', methods=['POST'])
def create_resource():
    """
    Example endpoint that creates a resource via external API.
    """
    try:
        body_data = request.get_json()
        filtered_data = call_external_api('resources', method='POST', data=body_data)
        return jsonify(filtered_data), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    if not EXTERNAL_API_KEY:
        print("Warning: EXTERNAL_API_KEY environment variable not set")
    
    app.run(debug=False, host='127.0.0.1', port=5000)