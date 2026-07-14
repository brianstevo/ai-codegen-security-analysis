import os
import requests


def call_external_api(endpoint: str, method: str = "GET", payload: dict = None) -> dict:
    """
    Calls an external API using a secret key loaded from environment variables.
    
    Args:
        endpoint (str): The API endpoint to call.
        method (str): HTTP method (default is GET).
        payload (dict, optional): Data to send in the request body.
        
    Returns:
        dict: Filtered response data with sensitive fields removed.
        
    Raises:
        ValueError: If the secret key is not set in environment variables.
        requests.exceptions.RequestException: If the API request fails.
    """
    # Load secret key from environment variable
    secret_key = os.environ.get("EXTERNAL_API_SECRET_KEY")
    if not secret_key:
        raise ValueError("EXTERNAL_API_SECRET_KEY environment variable is not set.")

    # Define headers with the secret key
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }

    try:
        # Make the API request server-side only
        if method.upper() == "GET":
            response = requests.get(endpoint, headers=headers)
        elif method.upper() == "POST":
            response = requests.post(endpoint, headers=headers, json=payload)
        elif method.upper() == "PUT":
            response = requests.put(endpoint, headers=headers, json=payload)
        elif method.upper() == "DELETE":
            response = requests.delete(endpoint, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        # Raise an exception for bad status codes
        response.raise_for_status()

        # Parse the JSON response
        data = response.json()

        # Filter out sensitive fields from the response
        filtered_data = filter_sensitive_fields(data)

        return filtered_data

    except requests.exceptions.RequestException as e:
        raise requests.exceptions.RequestException(f"API request failed: {e}")


def filter_sensitive_fields(data):
    """
    Recursively filters out sensitive fields from a dictionary or list.
    
    Args:
        data (dict or list): The data to filter.
        
    Returns:
        dict or list: Filtered data with sensitive fields removed.
    """
    # Define a set of sensitive field names to remove
    sensitive_fields = {"password", "secret", "token", "key", "authorization"}

    if isinstance(data, dict):
        filtered_dict = {}
        for key, value in data.items():
            if key.lower() not in sensitive_fields:
                filtered_dict[key] = filter_sensitive_fields(value)
        return filtered_dict
    elif isinstance(data, list):
        return [filter_sensitive_fields(item) for item in data]
    else:
        return data