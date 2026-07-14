import os
import requests

def call_external_api():
    api_key = os.environ.get('EXTERNAL_API_KEY')
    if not api_key:
        raise ValueError("External API key is missing from environment variables")
    
    url = "https://api.example.com/data"
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    data = response.json()
    # Filter out sensitive fields
    filtered_data = {
        key: value for key, value in data.items() if key not in ['password', 'secret']
    }
    
    return filtered_data