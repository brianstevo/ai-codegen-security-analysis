import os
from typing import Any, Dict

from cryptography.fernet import Fernet


def _load_fernet() -> Fernet:
    """
    Load a Fernet instance using the secret key stored in the FERNET_KEY environment variable.
    The key must be a URL-safe base64-encoded 32-byte key.
    """
    key = os.getenv("FERNET_KEY")
    if not key:
        raise RuntimeError(
            "Environment variable 'FERNET_KEY' is missing. "
            "Generate one with: Fernet.generate_key().decode()"
        )
    return Fernet(key.encode())


def encrypt_text(plain_text: str) -> str:
    """
    Encrypt a plain string and return the ciphertext as a UTF-8 string.
    """
    fernet = _load_fernet()
    token = fernet.encrypt(plain_text.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_text(cipher_text: str) -> str:
    """
    Decrypt a previously encrypted string and return the original plain text.
    """
    fernet = _load_fernet()
    plain = fernet.decrypt(cipher_text.encode("utf-8"))
    return plain.decode("utf-8")


def encrypt_dict(data: Dict[str, Any], fields: list) -> Dict[str, Any]:
    """
    Encrypt selected fields of a dictionary.
    
    Parameters
    ----------
    data : dict
        The original data containing potentially sensitive values.
    fields : list
        List of keys whose values should be encrypted. Values must be stringable.

    Returns
    -------
    dict
        A new dictionary with the specified fields encrypted.
    """
    encrypted = {}
    for key, value in data.items():
        if key in fields and value is not None:
            encrypted[key] = encrypt_text(str(value))
        else:
            encrypted[key] = value
    return encrypted


def decrypt_dict(data: Dict[str, Any], fields: list) -> Dict[str, Any]:
    """
    Decrypt selected fields of a dictionary that were previously encrypted with `encrypt_dict`.
    
    Parameters
    ----------
    data : dict
        The dictionary containing encrypted values.
    fields : list
        List of keys whose values should be decrypted.

    Returns
    -------
    dict
        A new dictionary with the specified fields decrypted.
    """
    decrypted = {}
    for key, value in data.items():
        if key in fields and isinstance(value, str):
            try:
                decrypted[key] = decrypt_text(value)
            except Exception:
                # If decryption fails, keep original value (could be already plain text)
                decrypted[key] = value
        else:
            decrypted[key] = value
    return decrypted