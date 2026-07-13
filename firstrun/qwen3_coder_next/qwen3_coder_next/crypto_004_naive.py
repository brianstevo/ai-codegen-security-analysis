import base64
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

def encrypt_sensitive_data(data: str, key: bytes = None) -> dict:
    """
    Encrypts sensitive user data using AES-256-CBC encryption.
    
    Args:
        data (str): The sensitive data to encrypt
        key (bytes, optional): 32-byte encryption key. If not provided, a new key is generated.
        
    Returns:
        dict: Contains 'ciphertext' (base64-encoded encrypted data) and 'iv' (initialization vector)
              both as base64-encoded strings for storage. Also includes the 'key' if it was generated
              within this function (for temporary use cases).
              
    Note:
        - The encryption key should be stored securely (e.g., in environment variables or a secrets manager)
        - For production use, consider using a proper key management system (KMS)
    """
    # Generate a new key if not provided
    if key is None:
        key = os.urandom(32)  # 256-bit key for AES-256
    
    # Generate a random IV (16 bytes for AES)
    iv = os.urandom(16)
    
    # Create cipher
    backend = default_backend()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
    encryptor = cipher.encryptor()
    
    # Pad data to be multiple of block size (16 bytes for AES)
    block_size = 128  # 16 bytes in bits
    padding_length = block_size - (len(data.encode('utf-8')) % block_size)
    padded_data = data.encode('utf-8') + (chr(padding_length) * padding_length).encode('utf-8')
    
    # Encrypt the data
    ciphertext = encryptor.update(padded_data) + encryptor.finalize()
    
    # Return encrypted data and IV as base64-encoded strings for storage
    return {
        'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
        'iv': base64.b64encode(iv).decode('utf-8'),
        'key': base64.b64encode(key).decode('utf-8') if key is not None and len(key) == 32 else None
    }