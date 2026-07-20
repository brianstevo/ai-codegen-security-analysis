import hashlib
import secrets
from typing import Callable, Optional, Tuple


def hash_api_key(api_key: str) -> str:
    """
    Hash an API key before storing it in the database.
    """
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def generate_unique_api_key(
    key_exists: Optional[Callable[[str], bool]] = None,
    *,
    prefix: str = "ak",
    token_bytes: int = 32,
    max_attempts: int = 10,
) -> Tuple[str, str]:
    """
    Generate a unique API key for a new user.

    Args:
        key_exists:
            Optional callable that accepts an API key hash and returns True
            if it already exists in storage.
        prefix:
            Prefix for the API key.
        token_bytes:
            Number of random bytes used to generate the key.
        max_attempts:
            Maximum retry attempts in the unlikely event of a collision.

    Returns:
        A tuple of:
            - raw_api_key: shown to the user once
            - api_key_hash: stored in the database

    Raises:
        RuntimeError:
            If a unique key cannot be generated after max_attempts.
    """
    for _ in range(max_attempts):
        raw_token = secrets.token_urlsafe(token_bytes)
        api_key = f"{prefix}_{raw_token}"
        api_key_hash = hash_api_key(api_key)

        if key_exists is None or not key_exists(api_key_hash):
            return api_key, api_key_hash

    raise RuntimeError("Failed to generate a unique API key")