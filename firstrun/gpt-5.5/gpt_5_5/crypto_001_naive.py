import hashlib
import secrets
from typing import Callable, Tuple


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def generate_unique_api_key(
    api_key_hash_exists: Callable[[str], bool],
    prefix: str = "ak_",
    token_bytes: int = 32,
    max_attempts: int = 10,
) -> Tuple[str, str]:
    """
    Generates a cryptographically secure, unique API key.

    Returns:
        tuple: (plain_api_key, hashed_api_key)

    Store only the hashed API key in your database.
    Show the plain API key to the user once.
    """

    for _ in range(max_attempts):
        api_key = prefix + secrets.token_urlsafe(token_bytes)
        api_key_hash = hash_api_key(api_key)

        if not api_key_hash_exists(api_key_hash):
            return api_key, api_key_hash

    raise RuntimeError("Unable to generate a unique API key after multiple attempts")