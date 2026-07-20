import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionError(Exception):
    """Raised when encryption or decryption fails."""
    pass


def _load_key() -> bytes:
    """
    Load the AES-256 key from the ENCRYPTION_KEY environment variable.

    The environment variable must contain a base64-encoded 32-byte (256-bit) key.
    Generate one with:
        python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
    """
    raw = os.environ.get("ENCRYPTION_KEY")
    if not raw:
        raise EncryptionError(
            "ENCRYPTION_KEY environment variable is not set."
        )

    try:
        key = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise EncryptionError(
            "ENCRYPTION_KEY is not valid base64."
        ) from exc

    if len(key) != 32:
        raise EncryptionError(
            "ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256."
        )

    return key


def encrypt(plaintext, associated_data: bytes | None = None) -> str:
    """
    Encrypt sensitive data using AES-256-GCM.

    A fresh 12-byte IV/nonce is generated with os.urandom for every call.
    The GCM authentication tag is appended by AESGCM to the ciphertext.
    The returned value is a base64 string containing: IV || ciphertext || tag.

    Args:
        plaintext: str or bytes to encrypt.
        associated_data: optional bytes that are authenticated but not encrypted.

    Returns:
        Base64-encoded string of (iv + ciphertext_with_tag).
    """
    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")
    elif not isinstance(plaintext, (bytes, bytearray)):
        raise EncryptionError("plaintext must be str or bytes.")

    key = _load_key()
    aesgcm = AESGCM(key)

    # 96-bit (12-byte) nonce is recommended for GCM.
    iv = os.urandom(12)

    try:
        # AESGCM.encrypt returns ciphertext with the 16-byte auth tag appended.
        ciphertext_with_tag = aesgcm.encrypt(iv, bytes(plaintext), associated_data)
    except Exception as exc:
        raise EncryptionError("Encryption failed.") from exc

    return base64.b64encode(iv + ciphertext_with_tag).decode("ascii")


def decrypt(token: str, associated_data: bytes | None = None) -> bytes:
    """
    Decrypt data produced by encrypt().

    Verifies the GCM authentication tag; raises EncryptionError if the
    ciphertext or associated data has been tampered with.

    Args:
        token: base64-encoded string of (iv + ciphertext_with_tag).
        associated_data: optional bytes that were authenticated during encryption.

    Returns:
        Decrypted plaintext as bytes.
    """
    if not isinstance(token, str):
        raise EncryptionError("token must be a base64 string.")

    try:
        blob = base64.b64decode(token, validate=True)
    except Exception as exc:
        raise EncryptionError("token is not valid base64.") from exc

    # 12-byte IV + at least the 16-byte tag.
    if len(blob) < 12 + 16:
        raise EncryptionError("token is too short to be valid.")

    iv = blob[:12]
    ciphertext_with_tag = blob[12:]

    key = _load_key()
    aesgcm = AESGCM(key)

    try:
        return aesgcm.decrypt(iv, ciphertext_with_tag, associated_data)
    except Exception as exc:
        # InvalidTag or any other failure -> reject.
        raise EncryptionError(
            "Decryption failed: authentication tag invalid or corrupt data."
        ) from exc