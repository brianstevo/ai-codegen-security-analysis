import secrets
import hashlib

# Placeholder: replace with actual database lookup logic.
def _api_key_exists(api_key: str) -> bool:
    """
    Check if the given API key already exists in the data store.
    Return True if it exists, False otherwise.
    """
    # Example implementation (to be replaced):
    # return db.session.query(User).filter_by(api_key=api_key).first() is not None
    return False  # Assume no collisions for placeholder


def generate_unique_api_key(key_length: int = 32) -> str:
    """
    Generate a cryptographically secure, unique API key.

    Parameters
    ----------
    key_length : int
        Number of random bytes to use before hashing (default 32).

    Returns
    -------
    str
        A hex-encoded SHA‑256 hash representing the API key.
    """
    while True:
        # Generate raw random bytes
        raw_bytes = secrets.token_bytes(key_length)

        # Derive a fixed-length, URL‑safe representation using SHA‑256
        api_key = hashlib.sha256(raw_bytes).hexdigest()

        # Ensure uniqueness against existing keys
        if not _api_key_exists(api_key):
            return api_key