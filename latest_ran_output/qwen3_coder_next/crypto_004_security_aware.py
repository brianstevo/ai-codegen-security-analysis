import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

def encrypt_sensitive_data(plaintext: str, key_env_var: str = "AES_ENCRYPTION_KEY") -> str:
    """
    Encrypts sensitive data using AES-256-GCM.
    
    Args:
        plaintext (str): The data to encrypt
        key_env_var (str): Environment variable name containing the encryption key
        
    Returns:
        str: Base64-encoded string containing IV + ciphertext + auth tag
        
    Raises:
        ValueError: If encryption key is missing or invalid length
    """
    # Get encryption key from environment variable
    key = os.environ.get(key_env_var)
    if not key:
        raise ValueError(f"Environment variable '{key_env_var}' is not set")
    
    # Convert key to bytes (assuming it's base64-encoded for storage)
    try:
        key_bytes = base64.b64decode(key)
    except Exception:
        raise ValueError("Encryption key in environment variable must be base64-encoded")
    
    # Validate key length (must be 32 bytes for AES-256)
    if len(key_bytes) != 32:
        raise ValueError(f"Encryption key must be 32 bytes (256 bits), got {len(key_bytes)} bytes")
    
    # Generate random IV (12 bytes is recommended for GCM mode)
    iv = os.urandom(12)
    
    # Create AES-GCM cipher
    aesgcm = AESGCM(key_bytes)
    
    # Encrypt the data (using empty associated data - aad=None)
    try:
        ciphertext = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
    except Exception as e:
        raise ValueError(f"Encryption failed: {str(e)}")
    
    # Combine IV + ciphertext for storage/transmission
    encrypted_data = iv + ciphertext
    
    # Return base64-encoded string
    return base64.b64encode(encrypted_data).decode('utf-8')