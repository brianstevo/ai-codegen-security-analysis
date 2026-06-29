import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionError(Exception):
    """Raised when encryption or decryption fails."""
    pass


def _load_key():
    """
    Load the AES-256 key from the ENCRYPTION_KEY environment variable.

    The key must be a base64-encoded 32-byte (256-bit) value.
    Never hardcode the key in source.
    """
    raw = os.environ.get("ENCRYPTION_KEY")
    if not raw:
        raise EncryptionError(
            "ENCRYPTION_KEY environment variable is not set."
        )
    try:
        key = base64.b64decode(raw)
    except Exception as exc:
        raise EncryptionError("ENCRYPTION_KEY is not valid base64.") from exc

    if len(key) != 32:
        raise EncryptionError(
            "ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256."
        )
    return key


def encrypt_data(plaintext, associated_data=None):
    """
    Encrypt sensitive data using AES-256-GCM.

    A fresh 12-byte IV (nonce) is generated with os.urandom for every call.
    The GCM auth tag is appended to the ciphertext automatically by AESGCM.

    Returns a base64-encoded string structured as: IV || ciphertext+tag

    :param plaintext: str or bytes to encrypt
    :param associated_data: optional bytes to authenticate but not encrypt
    :return: base64-encoded str of (iv + ciphertext_with_tag)
    """
    key = _load_key()

    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")
    if not isinstance(plaintext, (bytes, bytearray)):
        raise EncryptionError("plaintext must be str or bytes.")

    if associated_data is not None and isinstance(associated_data, str):
        associated_data = associated_data.encode("utf-8")

    # 96-bit (12-byte) IV/nonce is the recommended size for GCM.
    iv = os.urandom(12)

    aesgcm = AESGCM(key)
    try:
        # AESGCM appends the 16-byte auth tag to the ciphertext.
        ciphertext = aesgcm.encrypt(iv, bytes(plaintext), associated_data)
    except Exception as exc:
        raise EncryptionError("Encryption failed.") from exc

    # Store the IV alongside the ciphertext.
    payload = iv + ciphertext
    return base64.b64encode(payload).decode("utf-8")


def decrypt_data(token, associated_data=None):
    """
    Decrypt data produced by encrypt_data.

    Verifies the GCM auth tag; raises EncryptionError on tamper/auth failure.

    :param token: base64-encoded str of (iv + ciphertext_with_tag)
    :param associated_data: optional bytes that were authenticated on encrypt
    :return: decrypted plaintext as bytes
    """
    key = _load_key()

    if isinstance(token, str):
        token = token.encode("utf-8")

    try:
        payload = base64.b64decode(token)
    except Exception as exc:
        raise EncryptionError("Invalid base64 token.") from exc

    if len(payload) < 12 + 16:
        raise EncryptionError("Token is too short to contain IV and tag.")

    iv = payload[:12]
    ciphertext = payload[12:]

    if associated_data is not None and isinstance(associated_data, str):
        associated_data = associated_data.encode("utf-8")

    aesgcm = AESGCM(key)
    try:
        plaintext = aesgcm.decrypt(iv, ciphertext, associated_data)
    except Exception as exc:
        # InvalidTag and other failures are normalized here.
        raise EncryptionError(
            "Decryption failed: authentication tag mismatch or corrupt data."
        ) from exc

    return plaintext