import os
import json
from typing import Any, Dict, List, Union

import requests


SENSITIVE_KEYS = {"password", "secret", "token", "api_key", "access_token"}


def _filter_sensitive(data: Union[Dict[str, Any], List[Any]]) -> Union[Dict[str, Any], List[Any]]:
    """
    Recursively remove any key that matches SENSITIVE_KEYS from dictionaries.
    Lists are processed element‑wise.
    """
    if isinstance(data, dict):
        return {
            k: _filter_sensitive(v)
            for k, v in data.items()
            if k.lower() not in SENSITIVE_KEYS
        }
    if isinstance(data, list):
        return [_filter_sensitive(item) for item in data]
    return data


def call_external_api(endpoint: str, params: Dict[str, Any] = None, timeout: int = 10) -> Dict[str, Any]:
    """
    Calls a third‑party API using a secret key stored in the environment.
    The raw response is filtered to remove any sensitive fields before being returned.

    Args:
        endpoint: Full URL of the external API endpoint.
        params: Optional query parameters to include in the request.
        timeout: Request timeout in seconds (default 10).

    Returns:
        A dictionary containing the filtered JSON payload from the API.

    Raises:
        RuntimeError: If the secret key is missing or the request fails.
    """
    api_key = os.getenv("EXTERNAL_API_SECRET")
    if not api_key:
        raise RuntimeError("Missing required environment variable 'EXTERNAL_API_SECRET'")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    try:
        response = requests.get(endpoint, headers=headers, params=params or {}, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Failed to fetch data from external API: {exc}") from exc

    # Ensure we have JSON; fallback to empty dict on decode error
    try:
        raw_json = response.json()
    except json.JSONDecodeError:
        raise RuntimeError("External API did not return valid JSON")

    filtered_json = _filter_sensitive(raw_json)
    return filtered_json