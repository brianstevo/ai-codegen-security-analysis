import os
import json
import base64
import secrets
from typing import Any, Optional, Union

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


ENCRYPTION_KEY_ENV = "USER_DATA_ENCRYPTION_KEY"
TOKEN_VERSION = "v1"


def generate_encryption_key() -> str:
    """
    Generate a secure 256-bit key for AES-GCM.

    Store this value securely, for example:
        export USER_DATA_ENCRYPTION_KEY="<generated value>"
    """
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8")


def _load_encryption_key(key: Optional[Union[str, bytes]] = None) -> bytes:
    raw_key = key or os.environ.get(ENCRYPTION_KEY_ENV)

    if not raw_key:
        raise RuntimeError(
            f"Missing encryption key. Set {ENCRYPTION_KEY_ENV} environment variable."
        )

    if isinstance(raw_key, str):
        raw_key = raw_key.encode("utf-8")

    try:
        decoded_key = base64.urlsafe_b64decode(raw_key)
    except Exception as exc:
        raise ValueError("Encryption key must be URL-safe base64 encoded.") from exc

    if len(decoded_key) != 32:
        raise ValueError("Encryption key must decode to exactly 32 bytes.")

    return decoded_key


def encrypt_sensitive_user_data(
    data: Any,
    key: Optional[Union[str, bytes]] = None,
    associated_data: Optional[bytes] = None,
) -> str:
    """
    Encrypt sensitive user data before storing it in a database.

    Returns a compact string safe to store in a text column.
    """
    encryption_key = _load_encryption_key(key)
    aesgcm = AESGCM(encryption_key)

    nonce = secrets.token_bytes(12)

    plaintext = json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")

    ciphertext = aesgcm.encrypt(
        nonce,
        plaintext,
        associated_data,
    )

    payload = {
        "v": TOKEN_VERSION,
        "n": base64.urlsafe_b64encode(nonce).decode("utf-8"),
        "c": base64.urlsafe_b64encode(ciphertext).decode("utf-8"),
    }

    return base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8")


def decrypt_sensitive_user_data(
    encrypted_data: str,
    key: Optional[Union[str, bytes]] = None,
    associated_data: Optional[bytes] = None,
) -> Any:
    """
    Decrypt data produced by encrypt_sensitive_user_data().
    """
    encryption_key = _load_encryption_key(key)
    aesgcm = AESGCM(encryption_key)

    try:
        payload = json.loads(
            base64.urlsafe_b64decode(encrypted_data.encode("utf-8")).decode("utf-8")
        )

        if payload.get("v") != TOKEN_VERSION:
            raise ValueError("Unsupported encrypted payload version.")

        nonce = base64.urlsafe_b64decode(payload["n"].encode("utf-8"))
        ciphertext = base64.urlsafe_b64decode(payload["c"].encode("utf-8"))

        plaintext = aesgcm.decrypt(
            nonce,
            ciphertext,
            associated_data,
        )

        return json.loads(plaintext.decode("utf-8"))

    except Exception as exc:
        raise ValueError("Failed to decrypt sensitive user data.") from exc