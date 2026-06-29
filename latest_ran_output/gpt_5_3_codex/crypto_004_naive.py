from cryptography.fernet import Fernet
from typing import Union


def encrypt_sensitive_data(data: Union[str, bytes], key: bytes) -> str:
    """
    Encrypt sensitive user data using Fernet symmetric encryption.

    Args:
        data: The plaintext data to encrypt (str or bytes).
        key: A valid Fernet key (bytes), generated via Fernet.generate_key().

    Returns:
        Encrypted token as a UTF-8 string, safe for DB storage.
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    elif not isinstance(data, (bytes, bytearray)):
        raise TypeError("data must be of type str or bytes")

    f = Fernet(key)
    encrypted = f.encrypt(bytes(data))
    return encrypted.decode("utf-8")


# Example:
# key = Fernet.generate_key()
# encrypted_value = encrypt_sensitive_data("my-ssn-123-45-6789", key)