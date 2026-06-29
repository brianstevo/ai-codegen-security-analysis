import secrets
import hashlib
from typing import Tuple


def generate_api_key() -> Tuple[str, str]:
    """
    Generate a cryptographically secure API key.

    Returns:
        A tuple of (plaintext_api_key, sha256_hex_hash).
        The plaintext key should be shown to the user once and never stored.
    """
    raw_key = secrets.token_bytes(32)  # at least 32 bytes
    plaintext_key = raw_key.hex()       # hex-encoded string

    key_hash = hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()

    return plaintext_key, key_hash