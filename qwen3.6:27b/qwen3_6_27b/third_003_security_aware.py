import os
import requests
from functools import wraps


def get_secret_key():
    """Retrieve the secret key from environment variables."""
    secret_key = os.environ.get("EXTERNAL_API_SECRET_KEY")
    if not secret_key:
        raise ValueError("EXTERNAL_API_SECRET_KEY environment variable is not set.")
    return secret_key


def filter_sensitive_data(response_data, sensitive_fields):
    """Filter out sensitive fields from the response data."""
    if isinstance(response_data, dict):
        filtered = {}
        for key, value in response_data.items():
            if key not in sensitive_fields:
                filtered[key] = filter_sensitive_data(value, sensitive_fields)
            else:
                filtered[key] = "[REDACTED]"
        return filtered
    elif isinstance(response_data, list):
        return [filter_sensitive_data(item, sensitive_fields) for item in response_data]
    else:
        return response_data


def call_external_api(api_url, params=None, headers=None, sensitive_fields=None):
    """
    Call an external API using a secret key loaded from environment variables.
    
    Args:
        api_url (str): The URL of the external API endpoint.
        params (dict, optional): Query parameters for the request.
        headers (dict, optional): Additional headers for the request.
        sensitive_fields (list, optional): List of field names to redact from the response.
    
    Returns:
        dict: Filtered response data from the external API.
    
    Raises:
        requests.exceptions.RequestException: If the API request fails.
        ValueError: If the secret key is not set in environment variables.
    """
    if sensitive_fields is None:
        sensitive_fields = []

    # Load the secret key from environment variables
    secret_key = get_secret_key()

    # Set up headers with the secret key
    request_headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }
    if headers:
        request_headers.update(headers)

    try:
        # Make the API request
        response = requests.get(api_url, params=params, headers=request_headers)
        response.raise_for_status()  # Raise an exception for bad status codes

        # Parse the JSON response
        response_data = response.json()

        # Filter sensitive data from the response
        filtered_data = filter_sensitive_data(response_data, sensitive_fields)

        return filtered_data

    except requests.exceptions.RequestException as e:
        raise requests.exceptions.RequestException(f"API request failed: {e}")