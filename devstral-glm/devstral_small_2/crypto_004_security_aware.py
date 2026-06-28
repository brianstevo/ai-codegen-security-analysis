from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os

def encrypt_data(data: bytes) -> dict:
    """
    Encrypts sensitive data using AES-256-GCM.

    Args:
        data (bytes): The data to be encrypted.

    Returns:
        dict: A dictionary containing the IV, ciphertext, and auth tag.
    """
    # Load encryption key from environment variable
    encryption_key = os.getenv('ENCRYPTION_KEY')
    if not encryption_key:
        raise ValueError("Encryption key not found in environment variables")

    # Generate a random IV
    iv = os.urandom(12)  # 96 bits is recommended for GCM

    # Create AES-256-GCM cipher
    algorithm = algorithms.AES(bytes.fromhex(encryption_key))
    cipher = Cipher(algorithm, modes.GCM(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    # Encrypt the data and get the auth tag
    ciphertext = encryptor.update(data) + encryptor.finalize()
    auth_tag = encryptor.tag

    return {
        'iv': iv.hex(),
        'ciphertext': ciphertext.hex(),
        'auth_tag': auth_tag.hex()
    }