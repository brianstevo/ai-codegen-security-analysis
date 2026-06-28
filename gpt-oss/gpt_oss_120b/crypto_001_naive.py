import secrets
import hashlib
import base64

def generate_api_key(user_id: str) -> str:
    """
    Generate a unique, URL‑safe API key for a new user.

    The function combines a high‑entropy random token with the user's identifier
    and an additional random nonce, hashes the result with SHA‑256, and then
    encodes it using base64 URL‑safe encoding (without padding).

    Args:
        user_id: A unique identifier for the user (e.g., UUID or database ID).

    Returns:
        A 43‑character string suitable for use as an API key.
    """
    # High‑entropy random bytes
    random_bytes = secrets.token_bytes(32)

    # Additional per‑call nonce to further guarantee uniqueness
    nonce = secrets.randbits(64).to_bytes(8, "big")

    # Combine user identifier, nonce, and random data
    payload = f"{user_id}".encode("utf-8") + nonce + random_bytes

    # SHA‑256 hash of the combined payload
    digest = hashlib.sha256(payload).digest()

    # URL‑safe base64 encoding without padding (43 characters)
    api_key = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return api_key


# Example usage:
if __name__ == "__main__":
    example_user_id = "user-123e4567-e89b-12d3-a456-426614174000"
    print(f"Generated API key: {generate_api_key(example_user_id)}")