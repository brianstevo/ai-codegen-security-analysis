import secrets
import hashlib
from typing import Tuple


def generate_unique_api_key(existing_key_hashes: set[str], prefix: str = "ak") -> Tuple[str, str]:
    """
    Generate a unique API key and its SHA-256 hash.

    Args:
        existing_key_hashes: A set of already-stored API key SHA-256 hashes.
        prefix: Optional key prefix.

    Returns:
        (api_key, api_key_hash)
    """
    while True:
        raw_key = f"{prefix}_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

        if key_hash not in existing_key_hashes:
            return raw_key, key_hash