import os
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


def get_encryption_key() -> bytes:
    """
    Retrieve the encryption key from environment variables.
    In a production environment, this should be securely managed (e.g., using a secrets manager).
    """
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        raise ValueError("ENCRYPTION_KEY environment variable is not set.")
    
    # Ensure the key is 32 bytes for AES-256
    try:
        key_bytes = base64.b64decode(key)
        if len(key_bytes) != 32:
            raise ValueError("ENCRYPTION_KEY must be a valid 32-byte (256-bit) key encoded in base64.")
        return key_bytes
    except Exception as e:
        raise ValueError(f"Invalid ENCRYPTION_KEY format: {e}")


def encrypt_data(plaintext: str) -> dict:
    """
    Encrypts sensitive user data using AES-256-GCM.
    
    Args:
        plaintext (str): The sensitive data to encrypt.
        
    Returns:
        dict: A dictionary containing the nonce, tag, and ciphertext, all base64 encoded.
              This format allows for secure storage and later decryption.
    """
    if not isinstance(plaintext, str):
        raise TypeError("Plaintext must be a string.")
    
    try:
        key = get_encryption_key()
    except ValueError as e:
        raise RuntimeError(f"Failed to retrieve encryption key: {e}")
    
    # Generate a random 12-byte nonce for GCM mode
    nonce = os.urandom(12)
    
    # Create the cipher object
    backend = default_backend()
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce), backend=backend)
    encryptor = cipher.encryptor()
    
    # Encrypt the data
    ciphertext = encryptor.update(plaintext.encode('utf-8')) + encryptor.finalize()
    tag = encryptor.tag
    
    # Return components needed for decryption, base64 encoded for storage
    return {
        "nonce": base64.b64encode(nonce).decode('utf-8'),
        "tag": base64.b64encode(tag).decode('utf-8'),
        "ciphertext": base64.b64encode(ciphertext).decode('utf-8')
    }


def decrypt_data(encrypted_data: dict) -> str:
    """
    Decrypts sensitive user data using AES-256-GCM.
    
    Args:
        encrypted_data (dict): A dictionary containing 'nonce', 'tag', and 'ciphertext' keys,
                               all base64 encoded strings.
        
    Returns:
        str: The decrypted plaintext string.
    """
    if not isinstance(encrypted_data, dict):
        raise TypeError("Encrypted data must be a dictionary.")
    
    required_keys = {"nonce", "tag", "ciphertext"}
    if not required_keys.issubset(encrypted_data.keys()):
        raise ValueError("Encrypted data must contain 'nonce', 'tag', and 'ciphertext' keys.")
    
    try:
        key = get_encryption_key()
    except ValueError as e:
        raise RuntimeError(f"Failed to retrieve encryption key: {e}")
    
    try:
        nonce = base64.b64decode(encrypted_data["nonce"])
        tag = base64.b64decode(encrypted_data["tag"])
        ciphertext = base64.b64decode(encrypted_data["ciphertext"])
    except Exception as e:
        raise ValueError(f"Invalid base64 encoding in encrypted data: {e}")
    
    backend = default_backend()
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce, tag), backend=backend)
    decryptor = cipher.decryptor()
    
    try:
        plaintext_bytes = decryptor.update(ciphertext) + decryptor.finalize()
        return plaintext_bytes.decode('utf-8')
    except Exception as e:
        raise ValueError(f"Decryption failed. Data may be corrupted or key mismatch: {e}")