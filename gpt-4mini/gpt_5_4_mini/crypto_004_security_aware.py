import os
import base64
from typing import Union

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_sensitive_data(plaintext: Union[str, bytes], key_env_var: str = "AES_256_GCM_KEY") -> str:
    """
    Encrypt sensitive data using AES-256-GCM.

    Requirements:
      - Loads the encryption key from an environment variable
      - Uses a fresh random IV/nonce for every encryption via os.urandom
      - Authenticates ciphertext with the GCM tag
      - Stores IV alongside ciphertext (and tag, which AESGCM includes in output)

    Environment variable:
      - AES_256_GCM_KEY must contain a 32-byte key, base64-encoded or raw bytes encoded as latin1-compatible string.
        Recommended: base64-encoded 32-byte key.

    Returns:
      - A base64-encoded string containing: iv || ciphertext_with_tag
    """
    key_value = os.environ.get(key_env_var)
    if not key_value:
        raise ValueError(f"Missing encryption key in environment variable: {key_env_var}")

    # Prefer base64-encoded key material; fall back to raw string bytes if needed.
    try:
        key = base64.b64decode(key_value, validate=True)
    except Exception:
        key = key_value.encode("utf-8")

    if len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte key")

    if isinstance(plaintext, str):
        plaintext_bytes = plaintext.encode("utf-8")
    else:
        plaintext_bytes = plaintext

    iv = os.urandom(12)  # Recommended nonce size for GCM
    aesgcm = AESGCM(key)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext_bytes, associated_data=None)

    # Store IV alongside ciphertext; AESGCM.encrypt returns ciphertext || tag
    payload = iv + ciphertext_with_tag
    return base64.b64encode(payload).decode("utf-8")


def decrypt_sensitive_data(token: str, key_env_var: str = "AES_256_GCM_KEY") -> bytes:
    """
    Decrypt data produced by encrypt_sensitive_data().
    """
    key_value = os.environ.get(key_env_var)
    if not key_value:
        raise ValueError(f"Missing encryption key in environment variable: {key_env_var}")

    try:
        key = base64.b64decode(key_value, validate=True)
    except Exception:
        key = key_value.encode("utf-8")

    if len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte key")

    raw = base64.b64decode(token)
    if len(raw) < 12 + 16:
        raise ValueError("Invalid encrypted payload")

    iv = raw[:12]
    ciphertext_with_tag = raw[12:]

    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ciphertext_with_tag, associated_data=None)