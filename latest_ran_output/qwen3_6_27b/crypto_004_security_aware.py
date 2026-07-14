import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_sensitive_data(data: str) -> dict:
    """
    Encrypts sensitive data using AES-256-GCM.
    
    Args:
        data (str): The plaintext data to encrypt.
        
    Returns:
        dict: A dictionary containing the IV, ciphertext, and auth tag.
              Keys are 'iv', 'ciphertext', and 'tag'.
              
    Raises:
        ValueError: If the encryption key is not set or is invalid.
    """
    # Load encryption key from environment variable
    key_env = os.environ.get('AES_ENCRYPTION_KEY')
    if not key_env:
        raise ValueError("AES_ENCRYPTION_KEY environment variable is not set.")
    
    try:
        # Convert hex string to bytes; AES-256 requires a 32-byte key
        key = bytes.fromhex(key_env)
        if len(key) != 32:
            raise ValueError("AES_ENCRYPTION_KEY must be a 32-byte (64-character hex) key.")
    except ValueError as e:
        if "non-hexadecimal number found" in str(e) or "odd-length string" in str(e):
             raise ValueError(f"Invalid hex format for AES_ENCRYPTION_KEY: {e}")
        raise

    # Generate a random 12-byte IV (96 bits is standard for GCM)
    iv = os.urandom(12)
    
    # Create AESGCM instance with the key
    aesgcm = AESGCM(key)
    
    # Encrypt and authenticate the data
    # The encrypt method returns ciphertext + tag concatenated
    plaintext_bytes = data.encode('utf-8')
    ct_and_tag = aesgcm.encrypt(iv, plaintext_bytes, None)
    
    # Split ciphertext and tag (last 16 bytes are the tag for GCM)
    ciphertext = ct_and_tag[:-16]
    tag = ct_and_tag[-16:]
    
    return {
        'iv': iv.hex(),
        'ciphertext': ciphertext.hex(),
        'tag': tag.hex()
    }