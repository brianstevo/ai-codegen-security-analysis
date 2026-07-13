import base64
import json
import os
from typing import Optional, Union

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


KEY_ENV_VAR = "AES_256_GCM_KEY"
IV_SIZE_BYTES = 12
GCM_TAG_SIZE_BYTES = 16


def _b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


def _b64decode(data: str) -> bytes:
    return base64.b64decode(data.encode("utf-8"), validate=True)


def _load_aes256_key(env_var: str = KEY_ENV_VAR) -> bytes:
    encoded_key = os.environ.get(env_var)
    if not encoded_key:
        raise RuntimeError(f"Missing required environment variable: {env_var}")

    try:
        key = _b64decode(encoded_key)
    except Exception as exc:
        raise RuntimeError(f"{env_var} must contain a base64-encoded 32-byte key") from exc

    if len(key) != 32:
        raise RuntimeError(f"{env_var} must decode to exactly 32 bytes for AES-256")

    return key


def encrypt_sensitive_data(
    plaintext: Union[str, bytes],
    associated_data: Optional[bytes] = None,
    key_env_var: str = KEY_ENV_VAR,
) -> str:
    """
    Encrypts data with AES-256-GCM.

    The returned JSON string stores the IV, ciphertext, and GCM authentication tag
    together, all base64-encoded.
    """
    key = _load_aes256_key(key_env_var)

    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")

    iv = os.urandom(IV_SIZE_BYTES)
    aesgcm = AESGCM(key)

    encrypted = aesgcm.encrypt(iv, plaintext, associated_data)
    ciphertext = encrypted[:-GCM_TAG_SIZE_BYTES]
    tag = encrypted[-GCM_TAG_SIZE_BYTES:]

    payload = {
        "alg": "AES-256-GCM",
        "iv": _b64encode(iv),
        "ciphertext": _b64encode(ciphertext),
        "tag": _b64encode(tag),
    }

    return json.dumps(payload, separators=(",", ":"))


def decrypt_sensitive_data(
    encrypted_payload: str,
    associated_data: Optional[bytes] = None,
    key_env_var: str = KEY_ENV_VAR,
) -> bytes:
    """
    Decrypts and authenticates data encrypted by encrypt_sensitive_data.

    If the ciphertext, IV, tag, or associated data has been tampered with,
    AESGCM.decrypt will raise cryptography.exceptions.InvalidTag.
    """
    key = _load_aes256_key(key_env_var)
    payload = json.loads(encrypted_payload)

    iv = _b64decode(payload["iv"])
    ciphertext = _b64decode(payload["ciphertext"])
    tag = _b64decode(payload["tag"])

    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ciphertext + tag, associated_data)