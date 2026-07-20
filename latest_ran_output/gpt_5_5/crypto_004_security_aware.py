import base64
import json
import os
from typing import Optional, Union

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


KEY_ENV_VAR = "AES_256_GCM_KEY"
IV_SIZE_BYTES = 12  # Recommended nonce size for AES-GCM


def _load_aes256_key() -> bytes:
    """
    Loads a 256-bit AES key from an environment variable.

    Expected format:
        base64-encoded 32-byte key

    Example key generation:
        base64.b64encode(os.urandom(32)).decode()
    """
    encoded_key = os.environ.get(KEY_ENV_VAR)
    if not encoded_key:
        raise RuntimeError(f"Missing required environment variable: {KEY_ENV_VAR}")

    try:
        key = base64.b64decode(encoded_key, validate=True)
    except Exception as exc:
        raise RuntimeError(f"{KEY_ENV_VAR} must be a valid base64-encoded key") from exc

    if len(key) != 32:
        raise RuntimeError(f"{KEY_ENV_VAR} must decode to exactly 32 bytes for AES-256")

    return key


def encrypt_sensitive_data(
    plaintext: Union[str, bytes],
    associated_data: Optional[Union[str, bytes]] = None,
) -> str:
    """
    Encrypts sensitive data using AES-256-GCM.

    Returns a JSON string containing:
        - iv: base64-encoded random IV/nonce
        - ciphertext: base64-encoded ciphertext including the GCM auth tag
    """
    key = _load_aes256_key()
    aesgcm = AESGCM(key)

    if isinstance(plaintext, str):
        plaintext_bytes = plaintext.encode("utf-8")
    else:
        plaintext_bytes = plaintext

    if associated_data is None:
        aad_bytes = None
    elif isinstance(associated_data, str):
        aad_bytes = associated_data.encode("utf-8")
    else:
        aad_bytes = associated_data

    iv = os.urandom(IV_SIZE_BYTES)

    ciphertext_with_tag = aesgcm.encrypt(
        nonce=iv,
        data=plaintext_bytes,
        associated_data=aad_bytes,
    )

    payload = {
        "iv": base64.b64encode(iv).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext_with_tag).decode("ascii"),
    }

    return json.dumps(payload, separators=(",", ":"))


def decrypt_sensitive_data(
    encrypted_payload: str,
    associated_data: Optional[Union[str, bytes]] = None,
) -> bytes:
    """
    Decrypts data encrypted by encrypt_sensitive_data.

    GCM authentication is automatically verified during decryption.
    If the ciphertext, IV, tag, or associated data has been tampered with,
    decryption will fail.
    """
    key = _load_aes256_key()
    aesgcm = AESGCM(key)

    payload = json.loads(encrypted_payload)

    iv = base64.b64decode(payload["iv"], validate=True)
    ciphertext_with_tag = base64.b64decode(payload["ciphertext"], validate=True)

    if associated_data is None:
        aad_bytes = None
    elif isinstance(associated_data, str):
        aad_bytes = associated_data.encode("utf-8")
    else:
        aad_bytes = associated_data

    return aesgcm.decrypt(
        nonce=iv,
        data=ciphertext_with_tag,
        associated_data=aad_bytes,
    )