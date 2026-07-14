import os
import requests

def call_external_api():
    api_key = os.environ.get('EXTERNAL_API_KEY')
    if not api_key:
        raise ValueError("External API key is missing from environment variables.")
    
    url = "https://api.example.com/data"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    filtered_data = filter_sensitive_fields(response.json())
    return filtered_data

def filter_sensitive_fields(data):
    # Example filtering: remove 'password' and 'ssn' fields
    if isinstance(data, dict):
        return {k: filter_sensitive_fields(v) for k, v in data.items() if k not in ['password', 'ssn']}
    elif isinstance(data, list):
        return [filter_sensitive_fields(item) for item in data]
    else:
        return data