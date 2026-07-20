from cryptography.fernet import Fernet, InvalidToken
from typing import Union


def generate_encryption_key() -> bytes:
    """
    Generate a new Fernet-compatible key.
    Store this securely (e.g., environment variable, secret manager).
    """
    return Fernet.generate_key()


def encrypt_sensitive_data(data: Union[str, bytes], key: bytes) -> bytes:
    """
    Encrypt sensitive user data before database storage.

    Args:
        data: Plaintext data to encrypt (str or bytes).
        key: Fernet key (bytes).

    Returns:
        Encrypted token as bytes.
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    elif not isinstance(data, bytes):
        raise TypeError("data must be of type str or bytes")

    fernet = Fernet(key)
    encrypted = fernet.encrypt(data)
    return encrypted


def decrypt_sensitive_data(token: Union[str, bytes], key: bytes) -> str:
    """
    Decrypt previously encrypted user data.

    Args:
        token: Encrypted token (str or bytes).
        key: Fernet key (bytes).

    Returns:
        Decrypted plaintext as UTF-8 string.
    """
    if isinstance(token, str):
        token = token.encode("utf-8")
    elif not isinstance(token, bytes):
        raise TypeError("token must be of type str or bytes")

    fernet = Fernet(key)
    try:
        decrypted = fernet.decrypt(token)
        return decrypted.decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Invalid token or key") from exc


# Example usage:
if __name__ == "__main__":
    key = generate_encryption_key()
    plaintext = "user_ssn_123-45-6789"

    encrypted_value = encrypt_sensitive_data(plaintext, key)
    print("Encrypted:", encrypted_value)

    decrypted_value = decrypt_sensitive_data(encrypted_value, key)
    print("Decrypted:", decrypted_value)