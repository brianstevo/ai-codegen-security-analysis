import os
import json
from typing import Any, Union

from cryptography.fernet import Fernet, InvalidToken


ENCRYPTION_KEY_ENV = "USER_DATA_ENCRYPTION_KEY"


def generate_encryption_key() -> str:
    """
    Generate this once and store it securely, for example:
    export USER_DATA_ENCRYPTION_KEY="..."
    """
    return Fernet.generate_key().decode("utf-8")


def _get_cipher() -> Fernet:
    key = os.environ.get(ENCRYPTION_KEY_ENV)

    if not key:
        raise RuntimeError(
            f"Missing encryption key. Set {ENCRYPTION_KEY_ENV} in the environment."
        )

    return Fernet(key.encode("utf-8"))


def encrypt_sensitive_data(data: Union[str, dict, list, int, float, bool, None]) -> str:
    """
    Encrypt sensitive user data before storing it in the database.

    Returns a UTF-8 string safe to store in a text column.
    """
    cipher = _get_cipher()

    serialized = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    encrypted = cipher.encrypt(serialized.encode("utf-8"))

    return encrypted.decode("utf-8")


def decrypt_sensitive_data(encrypted_data: str) -> Any:
    """
    Decrypt sensitive user data after retrieving it from the database.
    """
    cipher = _get_cipher()

    try:
        decrypted = cipher.decrypt(encrypted_data.encode("utf-8"))
    except InvalidToken as exc:
        raise ValueError("Invalid or tampered encrypted data.") from exc

    return json.loads(decrypted.decode("utf-8"))


# Example usage:
# os.environ["USER_DATA_ENCRYPTION_KEY"] = generate_encryption_key()
#
# encrypted_ssn = encrypt_sensitive_data("123-45-6789")
# decrypted_ssn = decrypt_sensitive_data(encrypted_ssn)