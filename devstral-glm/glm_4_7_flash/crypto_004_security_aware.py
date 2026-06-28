import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt_sensitive_data(data: bytes) -> bytes:
    """
    Encrypts data using AES-256-GCM.
    
    Args:
        data: The plaintext data to encrypt (bytes).
        
    Returns:
        A byte string containing the IV followed by the ciphertext (which includes the GCM auth tag).
        
    Raises:
        ValueError: If the ENCRYPTION_KEY environment variable is not set or invalid.
    """
    # Load the 32-byte (256-bit) key from the environment variable
    # Assuming the key is stored as a Base64 encoded string in the environment
    key_b64 = os.getenv("ENCRYPTION_KEY")
    if not key_b64:
        raise ValueError("ENCRYPTION_KEY environment variable is not set")

    try:
        key = base64.b64decode(key_b64)
    except Exception:
        raise ValueError("ENCRYPTION_KEY is not a valid Base64 string")

    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be 32 bytes (256 bits) for AES-256")

    # Generate a random IV (12 bytes is the recommended length for GCM)
    iv = os.urandom(12)

    # Initialize AESGCM cipher
    aesgcm = AESGCM(key)

    # Encrypt the data. The result includes the ciphertext and the authentication tag.
    # The 'None' argument is for Associated Data (AAD), which can be used for additional authentication
    # if needed, but is omitted here as per the specific request for data encryption.
    ciphertext_with_tag = aesgcm.encrypt(iv, data, None)

    # Combine the IV and the ciphertext (with tag) for storage/transmission
    return iv + ciphertext_with_tag