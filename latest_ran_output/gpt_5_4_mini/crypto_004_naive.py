from cryptography.fernet import Fernet
import os


def encrypt_sensitive_user_data(data: str, key: bytes | None = None) -> tuple[bytes, bytes]:
    """
    Encrypt sensitive user data before storing it in the database.

    Args:
        data: Plaintext sensitive data to encrypt.
        key: Optional Fernet key. If not provided, uses/creates one from env var
             APP_ENCRYPTION_KEY. You should persist this key securely.

    Returns:
        A tuple of (encrypted_data, used_key)
    """
    if key is None:
        env_key = os.getenv("APP_ENCRYPTION_KEY")
        if env_key:
            key = env_key.encode()
        else:
            key = Fernet.generate_key()

    fernet = Fernet(key)
    encrypted_data = fernet.encrypt(data.encode("utf-8"))
    return encrypted_data, key