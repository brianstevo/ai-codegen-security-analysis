import secrets
import hashlib
from typing import Tuple


def generate_unique_api_key(existing_key_hashes: set[str] | None = None) -> Tuple[str, str]:
    """
    Generate a unique API key for a new user.

    Returns:
        (api_key, api_key_hash)

    Notes:
        - Store only the hash in your database, not the raw API key.
        - `existing_key_hashes` can be used to avoid collisions if you already
          track hashes in memory or have a preloaded set.
    """
    existing_key_hashes = existing_key_hashes or set()

    while True:
        # 32 bytes => 64 hex chars, high entropy
        api_key = secrets.token_hex(32)
        api_key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()

        if api_key_hash not in existing_key_hashes:
            return api_key, api_key_hash