from flask import Flask, jsonify, request
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

def get_api_key():
    """Retrieve the secret API key from environment variable."""
    api_key = os.environ.get('EXTERNAL_API_KEY')
    if not api_key:
        raise ValueError("EXTERNAL_API_KEY environment variable not set")
    return api_key

def filter_sensitive_fields(response_data):
    """Filter out sensitive fields from API response before sending to client."""
    # List of sensitive fields that should be removed from the response
    sensitive_fields = [
        'api_key',
        'secret',
        'token',
        'password',
        'auth_token',
        'access_token',
        'private_key',
        'secret_key'
    ]
    
    if isinstance(response_data, dict):
        filtered_data = {}
        for key, value in response_data.items():
            # Check if the key is sensitive (case-insensitive)
            if key.lower() not in sensitive_fields:
                if isinstance(value, dict):
                    filtered_data[key] = filter_sensitive_fields(value)
                elif isinstance(value, list):
                    filtered_data[key] = [
                        filter_sensitive_fields(item) if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    filtered_data[key] = value
        return filtered_data
    elif isinstance(response_data, list):
        return [
            filter_sensitive_fields(item) if isinstance(item, dict) else item
            for item in response_data
        ]
    return response_data

def call_external_api(endpoint, method='GET', params=None, json_data=None):
    """
    Call an external API using the secret key from environment variable.
    
    Args:
        endpoint: The API endpoint URL
        method: HTTP method (GET, POST, etc.)
        params: Query parameters
        json_data: JSON body data for POST/PUT requests
    
    Returns:
        Filtered response data safe for client consumption
    """
    try:
        # Get the API key from environment variable (never hardcoded)
        api_key = get_api_key()
        
        # Prepare headers with the secret API key
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        # Make the request server-side
        if method.upper() == 'GET':
            response = requests.get(
                endpoint,
                headers=headers,
                params=params,
                timeout=10
            )
        elif method.upper() == 'POST':
            response = requests.post(
                endpoint,
                headers=headers,
                json=json_data,
                params=params,
                timeout=10
            )
        elif method.upper() == 'PUT':
            response = requests.put(
                endpoint,
                headers=headers,
                json=json_data,
                params=params,
                timeout=10
            )
        elif method.upper() == 'DELETE':
            response = requests.delete(
                endpoint,
                headers=headers,
                params=params,
                timeout=10
            )
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # Check if the request was successful
        response.raise_for_status()
        
        # Get the response data
        response_data = response.json()
        
        # Filter out sensitive fields before returning to client
        filtered_response = filter_sensitive_fields(response_data)
        
        return {
            'success': True,
            'data': filtered_response,
            'status_code': response.status_code
        }
    
    except requests.exceptions.RequestException as e:
        # Handle request errors gracefully without exposing internal details
        return {
            'success': False,
            'error': 'Failed to fetch data from external service',
            'details': str(e)
        }
    except ValueError as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/api/data', methods=['GET'])
def get_external_data():
    """Flask route that safely calls external API and returns filtered data."""
    # Example endpoint (replace with actual API)
    external_api_url = os.environ.get(
        'EXTERNAL_API_URL',
        'https://api.example.com/data'
    )
    
    result = call_external_api(external_api_url)
    
    if result['success']:
        return jsonify(result['data']), result['status_code']
    else:
        return jsonify({'error': result['error']}), 500

@app.route('/api/search', methods=['GET'])
def search_external_api():
    """Flask route that searches external API with query parameters."""
    external_api_url = os.environ.get(
        'EXTERNAL_API_URL',
        'https://api.example.com/search'
    )
    
    # Get search query from request parameters
    search_query = request.args.get('q', '')
    
    if not search_query:
        return jsonify({'error': 'Search query required'}), 400
    
    params = {'query': search_query}
    result = call_external_api(external_api_url, params=params)
    
    if result['success']:
        return jsonify(result['data']), result['status_code']
    else:
        return jsonify({'error': result['error']}), 500

@app.route('/api/create', methods=['POST'])
def create_resource():
    """Flask route that creates a resource via external API."""
    external_api_url = os.environ.get(
        'EXTERNAL_API_URL',
        'https://api.example.com/resources'
    )
    
    # Get JSON data from request
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body required'}), 400
    
    result = call_external_api(external_api_url, method='POST', json_data=data)
    
    if result['success']:
        return jsonify(result['data']), result['status_code']
    else:
        return jsonify({'error': result['error']}), 500

if __name__ == '__main__':
    # Verify that the API key is set before running
    try:
        get_api_key()
        print("API key found in environment variables")
    except ValueError as e:
        print(f"Warning: {e}")
        print("Please set the EXTERNAL_API_KEY environment variable")
    
    app.run(debug=False, port=5000)