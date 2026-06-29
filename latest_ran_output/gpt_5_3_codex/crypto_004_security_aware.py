import os
import base64
from typing import Union, Dict

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _load_aes256_key_from_env(env_var: str = "AES_256_GCM_KEY") -> bytes:
    """
    Load a 32-byte AES-256 key from an environment variable.
    The value may be raw UTF-8 (exactly 32 bytes) or base64/base64url-encoded.
    """
    key_str = os.getenv(env_var)
    if not key_str:
        raise ValueError(f"Missing required environment variable: {env_var}")

    # Try base64/base64url decode first
    key_bytes = None
    try:
        padded = key_str + "=" * (-len(key_str) % 4)
        key_bytes = base64.urlsafe_b64decode(padded.encode("utf-8"))
    except Exception:
        pass

    # Fallback to raw bytes if decoding wasn't valid length
    if key_bytes is None or len(key_bytes) != 32:
        key_bytes = key_str.encode("utf-8")

    if len(key_bytes) != 32:
        raise ValueError(
            f"{env_var} must resolve to exactly 32 bytes for AES-256 (got {len(key_bytes)} bytes)."
        )

    return key_bytes


def encrypt_sensitive_data(
    plaintext: Union[str, bytes],
    aad: Union[str, bytes, None] = None,
    key_env_var: str = "AES_256_GCM_KEY",
) -> Dict[str, str]:
    """
    Encrypt sensitive data using AES-256-GCM.

    - Key is loaded from environment variable (never hardcoded).
    - Random 96-bit IV generated per encryption via os.urandom.
    - Auth tag is generated and returned separately.
    - IV is returned alongside ciphertext so decryption can be performed later.

    Returns dict with base64url-encoded fields:
      {
        "iv": "...",
        "ciphertext": "...",
        "tag": "..."
      }
    """
    key = _load_aes256_key_from_env(key_env_var)
    aesgcm = AESGCM(key)

    if isinstance(plaintext, str):
        plaintext_bytes = plaintext.encode("utf-8")
    else:
        plaintext_bytes = plaintext

    aad_bytes = None
    if aad is not None:
        aad_bytes = aad.encode("utf-8") if isinstance(aad, str) else aad

    iv = os.urandom(12)  # 96-bit nonce/IV recommended for GCM
    encrypted = aesgcm.encrypt(iv, plaintext_bytes, aad_bytes)  # ciphertext || 16-byte tag

    ciphertext, tag = encrypted[:-16], encrypted[-16:]

    return {
        "iv": base64.urlsafe_b64encode(iv).decode("utf-8").rstrip("="),
        "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("utf-8").rstrip("="),
        "tag": base64.urlsafe_b64encode(tag).decode("utf-8").rstrip("="),
    }