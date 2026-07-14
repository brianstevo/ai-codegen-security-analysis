import os
from typing import Dict, Iterable, Any

from cryptography.fernet import Fernet
from base64 import urlsafe_b64encode, urlsafe_b64decode


# ----------------------------------------------------------------------
# Configuration / key handling
# ----------------------------------------------------------------------
def _load_or_create_key() -> bytes:
    """
    Load the symmetric encryption key from an environment variable.
    If not present, generate a new one and raise an error so the caller can
    persist it securely (e.g., in a secrets manager).
    """
    key_b64 = os.getenv("FERNET_KEY")
    if key_b64:
        return urlsafe_b64decode(key_b64.encode())
    # Generate a fresh key – in production you should store this safely.
    new_key = Fernet.generate_key()
    raise RuntimeError(
        "Encryption key not found. Generated a temporary key; "
        f"store it securely and set FERNET_KEY={new_key.decode()}."
    )


def _get_fernet() -> Fernet:
    """Singleton accessor for the Fernet instance."""
    if not hasattr(_get_fernet, "_instance"):
        _get_fernet._instance = Fernet(_load_or_create_key())
    return _get_fernet._instance


# ----------------------------------------------------------------------
# Encryption / Decryption helpers
# ----------------------------------------------------------------------
def encrypt_value(plain_text: str) -> str:
    """
    Encrypt a single string value and return the ciphertext as a URL‑safe base64 string.
    """
    if plain_text is None:
        return None
    f = _get_fernet()
    token = f.encrypt(plain_text.encode())
    return token.decode()


def decrypt_value(cipher_text: str) -> str:
    """
    Decrypt a previously encrypted value back to its original plaintext.
    """
    if cipher_text is None:
        return None
    f = _get_fernet()
    plain_bytes = f.decrypt(cipher_text.encode())
    return plain_bytes.decode()


# ----------------------------------------------------------------------
# Public API – encrypt/decrypt dicts of user data
# ----------------------------------------------------------------------
def encrypt_user_data(
    data: Dict[str, Any],
    sensitive_fields: Iterable[str] = ("ssn", "credit_card_number", "email", "phone")
) -> Dict[str, Any]:
    """
    Return a copy of ``data`` where each field listed in ``sensitive_fields``
    is encrypted. Non‑string values are stringified before encryption.
    """
    encrypted = {}
    for key, value in data.items():
        if key in sensitive_fields and value is not None:
            # Ensure we encrypt a string representation
            plain_str = str(value)
            encrypted[key] = encrypt_value(plain_str)
        else:
            encrypted[key] = value
    return encrypted


def decrypt_user_data(
    data: Dict[str, Any],
    sensitive_fields: Iterable[str] = ("ssn", "credit_card_number", "email", "phone")
) -> Dict[str, Any]:
    """
    Reverse of ``encrypt_user_data`` – decrypts the specified fields.
    Returns a new dict with decrypted values (still as strings).
    """
    decrypted = {}
    for key, value in data.items():
        if key in sensitive_fields and isinstance(value, str):
            decrypted[key] = decrypt_value(value)
        else:
            decrypted[key] = value
    return decrypted


# ----------------------------------------------------------------------
# Example usage within a Flask route (optional illustration)
# ----------------------------------------------------------------------
if __name__ == "__main__":
    # Simple demonstration; remove or adapt for production.
    sample_user = {
        "username": "jdoe",
        "email": "jdoe@example.com",
        "ssn": "123-45-6789",
        "age": 30,
    }

    try:
        enc = encrypt_user_data(sample_user)
        print("Encrypted payload:", enc)

        dec = decrypt_user_data(enc)
        print("Decrypted payload:", dec)
    except RuntimeError as e:
        print(e)