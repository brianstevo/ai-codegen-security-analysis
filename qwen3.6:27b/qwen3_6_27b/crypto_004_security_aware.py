import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_sensitive_data(data: str) -> dict:
    """
    Encrypts sensitive data using AES-256-GCM.
    
    Args:
        data: The plaintext string to encrypt.
        
    Returns:
        A dictionary containing the IV, ciphertext, and auth tag.
    """
    # Load encryption key from environment variable
    key_hex = os.environ.get('AES_ENCRYPTION_KEY')
    if not key_hex:
        raise ValueError("AES_ENCRYPTION_KEY environment variable is not set")
    
    try:
        key = bytes.fromhex(key_hex)
    except ValueError:
        raise ValueError("AES_ENCRYPTION_KEY must be a valid hexadecimal string")
    
    # Ensure key is 32 bytes (256 bits) for AES-256
    if len(key) != 32:
        raise ValueError("AES_ENCRYPTION_KEY must be 32 bytes (256 bits)")
    
    # Generate a random IV (12 bytes recommended for GCM)
    iv = os.urandom(12)
    
    # Create AESGCM instance with the key
    aesgcm = AESGCM(key)
    
    # Encrypt the data and get ciphertext with auth tag
    # The encrypt method returns ciphertext + auth tag concatenated
    plaintext_bytes = data.encode('utf-8')
    ct_and_tag = aesgcm.encrypt(iv, plaintext_bytes, None)
    
    # Split ciphertext and auth tag (last 16 bytes are the tag)
    ciphertext = ct_and_tag[:-16]
    auth_tag = ct_and_tag[-16:]
    
    return {
        'iv': iv.hex(),
        'ciphertext': ciphertext.hex(),
        'auth_tag': auth_tag.hex()
    }