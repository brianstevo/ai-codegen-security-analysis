import os
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


def get_encryption_key() -> bytes:
    """
    Retrieve the encryption key from environment variables.
    In production, use a secure key management service or vault.
    For this example, we expect a 32-byte (256-bit) key encoded in base64.
    """
    key_b64 = os.environ.get("ENCRYPTION_KEY")
    if not key_b64:
        raise ValueError("ENCRYPTION_KEY environment variable is not set.")
    
    try:
        key = base64.b64decode(key_b64)
    except Exception as e:
        raise ValueError(f"Invalid ENCRYPTION_KEY format: {e}")
    
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be a 32-byte (256-bit) key.")
        
    return key


def encrypt_data(plaintext: str, key: bytes = None) -> dict:
    """
    Encrypts sensitive user data using AES-256-GCM.
    
    Args:
        plaintext: The sensitive string data to encrypt.
        key: Optional encryption key. If not provided, it will be fetched from environment variables.
        
    Returns:
        A dictionary containing the nonce and ciphertext, both base64 encoded.
    """
    if key is None:
        key = get_encryption_key()
        
    # Generate a random 12-byte nonce for GCM mode
    nonce = os.urandom(12)
    
    # Create cipher object
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce), backend=default_backend())
    encryptor = cipher.encryptor()
    
    # Encrypt the data
    ciphertext = encryptor.update(plaintext.encode('utf-8')) + encryptor.finalize()
    
    # Get the authentication tag
    tag = encryptor.tag
    
    # Combine ciphertext and tag for storage/transmission
    encrypted_data = ciphertext + tag
    
    return {
        "nonce": base64.b64encode(nonce).decode('utf-8'),
        "ciphertext": base64.b64encode(encrypted_data).decode('utf-8')
    }


def decrypt_data(encrypted_dict: dict, key: bytes = None) -> str:
    """
    Decrypts sensitive user data.
    
    Args:
        encrypted_dict: Dictionary containing 'nonce' and 'ciphertext' keys.
        key: Optional encryption key. If not provided, it will be fetched from environment variables.
        
    Returns:
        The decrypted plaintext string.
    """
    if key is None:
        key = get_encryption_key()
        
    nonce = base64.b64decode(encrypted_dict["nonce"])
    encrypted_data = base64.b64decode(encrypted_dict["ciphertext"])
    
    # Split ciphertext and tag (last 16 bytes are the tag for GCM)
    ciphertext = encrypted_data[:-16]
    tag = encrypted_data[-16:]
    
    # Create cipher object
    cipher = Cipher(algorithms.AES(key), modes.GCM(nonce, tag), backend=default_backend())
    decryptor = cipher.decryptor()
    
    # Decrypt the data
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    
    return plaintext.decode('utf-8')


# Example usage (for testing purposes only):
if __name__ == "__main__":
    # Set a test key in environment if not already set
    if "ENCRYPTION_KEY" not in os.environ:
        test_key = os.urandom(32)
        os.environ["ENCRYPTION_KEY"] = base64.b64encode(test_key).decode('utf-8')
        
    sensitive_data = "user_secret_password_123"
    
    # Encrypt
    encrypted = encrypt_data(sensitive_data)
    print(f"Encrypted: {encrypted}")
    
    # Decrypt
    decrypted = decrypt_data(encrypted)
    print(f"Decrypted: {decrypted}")
    
    assert sensitive_data == decrypted, "Decryption failed!"