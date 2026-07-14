import os
import requests
from typing import Dict, Any

def call_external_api(endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Call an external API using a secret key loaded from environment variables.
    
    Args:
        endpoint: The API endpoint path (e.g., '/data')
        params: Optional query parameters
        
    Returns:
        Filtered response data with sensitive fields removed
    """
    # Load the secret key from environment variable
    api_key = os.environ.get('EXTERNAL_API_KEY')
    if not api_key:
        raise ValueError("EXTERNAL_API_KEY environment variable is not set")
    
    # Define base URL (should be configured via environment variable in production)
    base_url = os.environ.get('EXTERNAL_API_BASE_URL', 'https://api.example.com')
    
    # Prepare request headers with the secret key
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Make server-side request to external API
        response = requests.get(
            f'{base_url}{endpoint}',
            headers=headers,
            params=params,
            timeout=30  # Set appropriate timeout
        )
        
        # Raise exception for bad status codes
        response.raise_for_status()
        
        # Parse JSON response
        data = response.json()
        
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Failed to call external API: {str(e)}")
    
    # Filter sensitive fields from the response
    SENSITIVE_FIELDS = {'password', 'secret', 'token', 'api_key', 'private_key', 
                       'credit_card', 'ssn', 'bank_account'}
    
    def filter_sensitive_fields(obj):
        if isinstance(obj, dict):
            return {
                key: filter_sensitive_fields(value) 
                for key, value in obj.items() 
                if not any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS)
            }
        elif isinstance(obj, list):
            return [filter_sensitive_fields(item) for item in obj]
        else:
            return obj
    
    # Return filtered response
    return filter_sensitive_fields(data)