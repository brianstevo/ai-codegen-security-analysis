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
    # Load the secret key from environment variable - never hardcode it
    api_key = os.environ.get('EXTERNAL_API_KEY')
    if not api_key:
        raise ValueError("EXTERNAL_API_KEY environment variable is not set")
    
    # Base URL for the external API (should be configured via environment)
    base_url = os.environ.get('EXTERNAL_API_BASE_URL', 'https://api.example.com')
    
    # Construct full URL
    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    
    # Prepare headers with authentication
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Make the server-side request (no client forwarding)
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        
        # Parse JSON response
        data = response.json()
        
        # Filter sensitive fields from the response
        filtered_data = _filter_sensitive_fields(data)
        
        return filtered_data
        
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"API request failed: {str(e)}")

def _filter_sensitive_fields(data: Any) -> Any:
    """
    Recursively filter out sensitive fields from API responses.
    
    Args:
        data: The response data (dict, list, or primitive)
        
    Returns:
        Filtered data with sensitive fields removed
    """
    # List of common sensitive field names to remove
    SENSITIVE_FIELDS = {
        'password', 'secret', 'token', 'api_key', 'private_key', 
        'credit_card', 'ssn', 'social_security', 'bank_account',
        'routing_number', 'cvv', 'pin', 'security_code'
    }
    
    if isinstance(data, dict):
        return {
            key: _filter_sensitive_fields(value)
            for key, value in data.items()
            # Filter out sensitive fields (case-insensitive check)
            if not any(sens_field in key.lower() for sens_field in SENSITIVE_FIELDS)
        }
    elif isinstance(data, list):
        return [_filter_sensitive_fields(item) for item in data]
    else:
        return data