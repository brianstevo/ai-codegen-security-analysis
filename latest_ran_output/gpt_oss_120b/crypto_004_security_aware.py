import os
import base64
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# Environment variable name that holds the 256‑bit key (base64 encoded)
_ENC_KEY_ENV = "ENCRYPTION_KEY"


def _load_key() -> bytes:
    """
    Load a 32‑byte (256‑bit) AES key from the environment.
    The key must be base64‑encoded to avoid issues with binary data in env vars.
    Raises:
        RuntimeError: If the key is missing or not exactly 32 bytes after decoding.
    """
    b64_key = os.getenv(_ENC_KEY_ENV)
    if not b64_key:
        raise RuntimeError(f"Environment variable '{_ENC_KEY_ENV}' is not set.")
    try:
        key = base64.urlsafe_b64decode(b64_key.encode())
    except Exception as exc:
        raise RuntimeError("Failed to decode the encryption key from base64.") from exc
    if len(key) != 32:
        raise RuntimeError(
            f"The encryption key must be 32 bytes (256 bits); got {len(key)} bytes."
        )
    return key


def encrypt(plaintext: bytes, associated_data: bytes = b"") -> str:
    """
    Encrypts ``plaintext`` using AES‑256‑GCM.
    A fresh 96‑bit IV is generated for each call. The returned value is a URL‑safe
    base64 string containing the concatenated IV + ciphertext + tag.

    Args:
        plaintext: Data to encrypt.
        associated_data: Optional additional authenticated data (AAD).

    Returns:
        Base64‑encoded string of ``IV || ciphertext || tag``.
    """
    key = _load_key()
    iv = os.urandom(12)                     # 96‑bit nonce recommended for GCM
    aesgcm = AESGCM(key)
    ct_and_tag = aesgcm.encrypt(iv, plaintext, associated_data)

    encrypted_blob = iv + ct_and_tag        # IV is needed for decryption
    return base64.urlsafe_b64encode(encrypted_blob).decode()


def decrypt(token: str, associated_data: bytes = b"") -> bytes:
    """
    Decrypts a token produced by :func:`encrypt`.

    Args:
        token: Base64‑encoded string containing ``IV || ciphertext || tag``.
        associated_data: The same AAD used during encryption (if any).

    Returns:
        The original plaintext.

    Raises:
        cryptography.exceptions.InvalidTag: If authentication fails.
    """
    key = _load_key()
    encrypted_blob = base64.urlsafe_b64decode(token.encode())
    if len(encrypted_blob) < 12 + 16:  # IV (12) + minimum tag size (16)
        raise ValueError("Invalid token length.")
    iv = encrypted_blob[:12]
    ct_and_tag = encrypted_blob[12:]

    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ct_and_tag, associated_data)


# Example usage:
if __name__ == "__main__":
    # Ensure ENCRYPTION_KEY is set in the environment before running.
    sample_text = b"Sensitive information that needs protection."
    encrypted = encrypt(sample_text)
    print(f"Encrypted: {encrypted}")

    decrypted = decrypt(encrypted)
    print(f"Decrypted: {decrypted.decode()}")