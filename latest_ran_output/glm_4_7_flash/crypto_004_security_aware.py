import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt_sensitive_data(data: bytes) -> bytes:
    """
    Encrypts sensitive data using AES-256-GCM.
    
    Args:
        data (bytes): The plaintext data to encrypt.
        
    Returns:
        bytes: A concatenated byte string containing the IV (12 bytes) 
               followed by the ciphertext (which includes the GCM auth tag).
               
    Raises:
        ValueError: If the ENCRYPTION_KEY environment variable is not set or invalid.
    """
    # 1. Load the encryption key from the environment variable
    # We assume the key is stored as a Base64 encoded string of the raw 32-byte key
    key_b64 = os.getenv('ENCRYPTION_KEY')
    if not key_b64:
        raise ValueError("ENCRYPTION_KEY environment variable is not set")

    try:
        key = base64.b64decode(key_b64)
    except Exception:
        raise ValueError("ENCRYPTION_KEY is not valid Base64")

    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be 32 bytes (256 bits) for AES-256")

    # 2. Generate a random IV using os.urandom
    # GCM recommends a 12-byte IV
    iv = os.urandom(12)

    # 3. Encrypt the data using AES-256-GCM
    aesgcm = AESGCM(key)
    # AESGCM.encrypt returns the ciphertext concatenated with the authentication tag
    ciphertext_with_tag = aesgcm.encrypt(iv, data, None)

    # 4. Return the IV alongside the ciphertext
    return iv + ciphertext_with_tag