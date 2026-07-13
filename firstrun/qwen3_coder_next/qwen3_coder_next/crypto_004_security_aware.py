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
        ValueError: If the environment variable is not set or contains an invalid key
    """
    # Get the encryption key from environment variable
    key_base64 = os.environ.get(key_env_var)
    if not key_base64:
        raise ValueError(f"Environment variable '{key_env_var}' is not set")
    
    try:
        # Decode the base64-encoded key
        key = base64.b64decode(key_base64)
        
        # Validate key length (must be 32 bytes for AES-256)
        if len(key) != 32:
            raise ValueError(f"Encryption key must be 32 bytes (256 bits), got {len(key)} bytes")
    except Exception as e:
        raise ValueError(f"Invalid encryption key in environment variable '{key_env_var}': {str(e)}")
    
    # Generate a random IV (12 bytes is recommended for GCM mode)
    iv = os.urandom(12)
    
    # Create AES-GCM cipher
    aesgcm = AESGCM(key)
    
    try:
        # Encrypt the data with associated data (optional, can be None)
        ciphertext = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
        
        # Combine IV + ciphertext for storage/transmission
        encrypted_data = iv + ciphertext
        
        # Return as base64-encoded string
        return base64.b64encode(encrypted_data).decode('utf-8')
    
    except Exception as e:
        raise ValueError(f"Encryption failed: {str(e)}")