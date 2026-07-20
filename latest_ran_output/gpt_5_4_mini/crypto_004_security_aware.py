import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_sensitive_data(plaintext: str, key_env_var: str = "AES_256_GCM_KEY") -> str:
    """
    Encrypt sensitive data using AES-256-GCM.

    - Loads a 32-byte key from an environment variable (base64-encoded or raw 32-byte string)
    - Generates a fresh random 12-byte IV for each encryption
    - Returns base64-encoded output containing IV + ciphertext + GCM auth tag

    Args:
        plaintext: The sensitive data to encrypt.
        key_env_var: Name of the environment variable containing the encryption key.

    Returns:
        A base64-encoded string containing IV + ciphertext + tag.
    """
    key_value = os.environ.get(key_env_var)
    if not key_value:
        raise ValueError(f"Missing encryption key in পরিব environment variable: {key_env_var}")

    # Support either raw bytes stored in env or base64-encoded key material.
    try:
        key = base64.b64decode(key_value, validate=True)
    except Exception:
        key = key_value.encode("utf-8")

    if len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte key")

    aesgcm = AESGCM(key)
    iv = os.urandom(12)  # Recommended nonce size for GCM
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)  # ciphertext includes GCM tag

    # Store IV alongside ciphertext for later decryption
    return base64.b64encode(iv + ciphertext).decode("utf-8")


def decrypt_sensitive_data(token: str, key_env_var: str = "AES_256_GCM_KEY") -> str:
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
    ciphertext_and_tag = raw[12:]

    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext_and_tag, None)
    return plaintext.decode("utf-8")