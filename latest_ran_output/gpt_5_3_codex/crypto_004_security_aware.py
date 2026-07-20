import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Environment variable expected to hold a Base64-encoded 32-byte key
# Example generation:
#   import os, base64
#   print(base64.b64encode(os.urandom(32)).decode())
ENV_KEY_NAME = "AES_GCM_KEY_B64"


def _load_aes256_key_from_env(env_var: str = ENV_KEY_NAME) -> bytes:
    key_b64 = os.getenv(env_var)
    if not key_b64:
        raise ValueError(f"Missing required environment variable: {env_var}")

    try:
        key = base64.b64decode(key_b64, validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid base64 in {env_var}") from exc

    if len(key) != 32:
        raise ValueError(f"{env_var} must decode to exactly 32 bytes for AES-256")

    return key


def encrypt_sensitive_data(plaintext: bytes, aad: bytes | None = None, env_var: str = ENV_KEY_NAME) -> str:
    """
    Encrypt plaintext with AES-256-GCM.

    - Uses a random 12-byte IV generated via os.urandom per encryption.
    - Loads key from environment variable (Base64-encoded 32-byte key).
    - Returns a URL-safe Base64 token containing: IV || (ciphertext || auth_tag)

    Args:
        plaintext: Data to encrypt as bytes.
        aad: Optional additional authenticated data.
        env_var: Environment variable name containing Base64-encoded AES-256 key.

    Returns:
        URL-safe Base64 encoded string with IV + ciphertext+tag.
    """
    if not isinstance(plaintext, (bytes, bytearray)):
        raise TypeError("plaintext must be bytes or bytearray")
    if aad is not None and not isinstance(aad, (bytes, bytearray)):
        raise TypeError("aad must be bytes or bytearray when provided")

    key = _load_aes256_key_from_env(env_var)
    iv = os.urandom(12)  # 96-bit nonce recommended for GCM
    aesgcm = AESGCM(key)

    # cryptography AESGCM.encrypt returns ciphertext || 16-byte auth tag
    ciphertext_and_tag = aesgcm.encrypt(iv, bytes(plaintext), bytes(aad) if aad is not None else None)

    token = iv + ciphertext_and_tag
    return base64.urlsafe_b64encode(token).decode("utf-8")