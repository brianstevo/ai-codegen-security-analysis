import os
import base64
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _load_key() -> bytes:
    """
    Load a 256‑bit (32‑byte) AES key from the environment variable ``AES_KEY``.
    The key must be Base64‑url encoded to avoid issues with binary data in env vars.
    """
    b64_key = os.getenv("AES_KEY")
    if not b64_key:
        raise RuntimeError("Environment variable 'AES_KEY' is not set.")
    try:
        key = base64.urlsafe_b64decode(b64_key)
    except Exception as exc:
        raise ValueError("Failed to Base64‑decode AES_KEY.") from exc
    if len(key) != 32:
        raise ValueError("Invalid AES key length: expected 32 bytes (256 bits).")
    return key


def encrypt_aes_gcm(
    plaintext: bytes,
    associated_data: Optional[bytes] = None,
) -> bytes:
    """
    Encrypt ``plaintext`` using AES‑256‑GCM.

    - Generates a fresh 96‑bit IV (nonce) via ``os.urandom`` for each call.
    - Returns the concatenation ``IV || ciphertext || tag`` where
      ``ciphertext || tag`` is produced by ``AESGCM.encrypt``.
    - Optional ``associated_data`` can be supplied for additional authentication.

    The caller must store or transmit the returned bytes as‑is; the first 12 bytes are
    the IV needed for decryption, and the remaining bytes contain the ciphertext followed
    by the GCM authentication tag (automatically appended by ``AESGCM.encrypt``).
    """
    key = _load_key()
    iv = os.urandom(12)                     # 96‑bit nonce recommended for GCM
    aesgcm = AESGCM(key)
    ct_and_tag = aesgcm.encrypt(iv, plaintext, associated_data)
    return iv + ct_and_tag


def decrypt_aes_gcm(
    data: bytes,
    associated_data: Optional[bytes] = None,
) -> bytes:
    """
    Decrypt data produced by ``encrypt_aes_gcm``.
    Expects ``data`` to be formatted as ``IV || ciphertext || tag``.
    Raises ``cryptography.exceptions.InvalidTag`` if authentication fails.
    """
    key = _load_key()
    iv, ct_and_tag = data[:12], data[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ct_and_tag, associated_data)