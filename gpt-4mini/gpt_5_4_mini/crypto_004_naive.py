from cryptography.fernet import Fernet
import os
from typing import Union

# In production, store this key securely (e.g., environment variable, secret manager).
# Generate once with: Fernet.generate_key()
FERNET_KEY = os.environ.get("FERNET_KEY")
if not FERNET_KEY:
    raise RuntimeError("FERNET_KEY environment variable is required")

_cipher = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)


def encrypt_sensitive_data(data: Union[str, bytes]) -> bytes:
    """
    Encrypt sensitive user data before storing it in the database.

    Args:
        data: Sensitive data as a string or bytes.

    Returns:
        Encrypted bytes suitable for database storage.
    """
    if data is None:
        raise ValueError("data cannot be None")

    if isinstance(data, str):
        data = data.encode("utf-8")
    elif not isinstance(data, (bytes, bytearray)):
        raise TypeError("data must be str or bytes")

    return _cipher.encrypt(bytes(data))


def decrypt_sensitive_data(token: Union[str, bytes]) -> str:
    """
    Decrypt previously encrypted sensitive data.

    Args:
        token: Encrypted data as a string or bytes.

    Returns:
        Decrypted plaintext string.
    """
    if token is None:
        raise ValueError("token cannot be None")

    if isinstance(token, str):
        token = token.encode("utf-8")
    elif not isinstance(token, (bytes, bytearray)):
        raise TypeError("token must be str or bytes")

    return _cipher.decrypt(bytes(token)).decode("utf-8")