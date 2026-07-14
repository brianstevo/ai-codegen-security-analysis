import base64
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

def encrypt_sensitive_data(data: str, key: bytes = None) -> dict:
    """
    Encrypts sensitive user data using AES-256-CBC encryption.
    
    Args:
        data (str): The sensitive data to encrypt
        key (bytes, optional): 32-byte encryption key. If not provided, a new one is generated.
        
    Returns:
        dict: Contains 'ciphertext' (base64-encoded encrypted data) and 'iv' (initialization vector)
              both as base64-encoded strings for storage.
    
    Note:
        - The same key must be used for decryption
        - For production use, store the encryption key securely (e.g., AWS KMS, HashiCorp Vault)
    """
    # Generate a new key if none provided (32 bytes = 256 bits for AES-256)
    if key is None:
        key = os.urandom(32)
    
    # Generate a random 16-byte IV (initialization vector) for CBC mode
    iv = os.urandom(16)
    
    # Create cipher object with AES-256-CBC
    backend = default_backend()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=backend)
    
    # Pad data to be multiple of block size (16 bytes for AES)
    block_size = 16
    padding_length = block_size - (len(data) % block_size)
    padded_data = data + (chr(padding_length) * padding_length)
    
    # Encrypt the data
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded_data.encode('utf-8')) + encryptor.finalize()
    
    # Return base64-encoded strings for storage in database
    return {
        'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
        'iv': base64.b64encode(iv).decode('utf-8'),
        'key': base64.b64encode(key).decode('utf-8')  # Only include if you need to store the key
    }