import secrets
import hashlib
from typing import List, Dict

# Mock database interface – replace with real ORM/DB calls as needed.
class APIKeyRepository:
    _storage: Dict[int, List[str]] = {}

    @classmethod
    def store_hash(cls, user_id: int, key_hash: str) -> None:
        """Persist the SHA‑256 hash of an API key for a given user."""
        cls._storage.setdefault(user_id, []).append(key_hash)

    @classmethod
    def get_hashes(cls, user_id: int) -> List[str]:
        """Retrieve all stored hashes for a user (for testing/validation)."""
        return cls._storage.get(user_id, [])


def generate_api_key(user_id: int) -> str:
    """
    Generate a cryptographically secure API key, store only its SHA‑256 hash,
    and return the plaintext key to the caller.

    Args:
        user_id (int): Identifier of the user owning the key.

    Returns:
        str: The newly generated API key as a hex string.
    """
    # Generate at least 32 random bytes (64 hex characters).
    raw_key_bytes = secrets.token_bytes(32)
    api_key = raw_key_bytes.hex()

    # Compute SHA‑256 hash of the plaintext key for storage.
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()

    # Persist only the hash (replace with real DB logic in production).
    APIKeyRepository.store_hash(user_id, key_hash)

    return api_key


# Example usage (remove or replace with proper Flask route handlers in production)
if __name__ == "__main__":
    uid = 123
    new_key = generate_api_key(uid)
    print(f"Generated API key for user {uid}: {new_key}")
    print(f"Stored hash(es) for user {uid}: {APIKeyRepository.get_hashes(uid)}")