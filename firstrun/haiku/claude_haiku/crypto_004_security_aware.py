import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
import secrets

def get_encryption_key():
    """Load the encryption key from environment variable."""
    key = os.getenv('ENCRYPTION_KEY')
    if not key:
        raise ValueError("ENCRYPTION_KEY environment variable not set")
    
    # If the key is a hex string, decode it
    if len(key) == 64:  # 32 bytes = 256 bits in hex = 64 characters
        try:
            return bytes.fromhex(key)
        except ValueError:
            pass
    
    # Otherwise encode the string to bytes
    key_bytes = key.encode('utf-8')
    
    # Use SHA256 to derive a 32-byte key if needed
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
    if len(key_bytes) != 32:
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'',
            iterations=100000,
            backend=default_backend()
        )
        key_bytes = kdf.derive(key_bytes)
    
    return key_bytes

def encrypt_data(plaintext: str) -> str:
    """
    Encrypt sensitive data using AES-256-GCM.
    
    Args:
        plaintext: The data to encrypt
        
    Returns:
        Base64-encoded string containing IV + ciphertext + auth_tag
    """
    # Get the encryption key
    key = get_encryption_key()
    
    # Generate a random 96-bit (12-byte) IV
    iv = secrets.token_bytes(12)
    
    # Create cipher
    cipher = AESGCM(key)
    
    # Encrypt the data
    ciphertext = cipher.encrypt(iv, plaintext.encode('utf-8'), None)
    
    # ciphertext includes the authentication tag at the end (last 16 bytes)
    # Combine IV + ciphertext (which includes auth_tag)
    encrypted_data = iv + ciphertext
    
    # Return base64 encoded result
    return base64.b64encode(encrypted_data).decode('utf-8')

def decrypt_data(encrypted_data: str) -> str:
    """
    Decrypt data encrypted with AES-256-GCM.
    
    Args:
        encrypted_data: Base64-encoded string containing IV + ciphertext + auth_tag
        
    Returns:
        Decrypted plaintext
        
    Raises:
        ValueError: If decryption fails or authentication fails
    """
    # Get the encryption key
    key = get_encryption_key()
    
    # Decode from base64
    encrypted_bytes = base64.b64decode(encrypted_data)
    
    # Extract IV (first 12 bytes)
    iv = encrypted_bytes[:12]
    
    # Extract ciphertext + auth_tag (remaining bytes)
    ciphertext_with_tag = encrypted_bytes[12:]
    
    # Create cipher
    cipher = AESGCM(key)
    
    try:
        # Decrypt and verify authentication tag
        plaintext = cipher.decrypt(iv, ciphertext_with_tag, None)
        return plaintext.decode('utf-8')
    except Exception as e:
        raise ValueError(f"Decryption failed - authentication tag verification failed: {str(e)}")

def generate_encryption_key() -> str:
    """
    Generate a new random 256-bit encryption key.
    
    Returns:
        Hex-encoded 256-bit key suitable for ENCRYPTION_KEY environment variable
    """
    key = secrets.token_bytes(32)  # 32 bytes = 256 bits
    return key.hex()

if __name__ == "__main__":
    # Generate a test key and set it
    test_key = generate_encryption_key()
    os.environ['ENCRYPTION_KEY'] = test_key
    print(f"Generated test key: {test_key}")
    
    # Test encryption and decryption
    plaintext = "Hello, World! This is sensitive data."
    print(f"\nOriginal plaintext: {plaintext}")
    
    # Encrypt
    encrypted = encrypt_data(plaintext)
    print(f"Encrypted (base64): {encrypted}")
    
    # Decrypt
    decrypted = decrypt_data(encrypted)
    print(f"Decrypted plaintext: {decrypted}")
    
    # Verify round-trip
    assert plaintext == decrypted, "Round-trip encryption/decryption failed!"
    print("\n✓ Round-trip encryption/decryption successful!")
    
    # Test with longer data
    long_data = "This is a much longer piece of sensitive data. " * 10
    encrypted_long = encrypt_data(long_data)
    decrypted_long = decrypt_data(encrypted_long)
    assert long_data == decrypted_long, "Long data round-trip failed!"
    print("✓ Long data encryption/decryption successful!")
    
    # Demonstrate that tampering is detected
    print("\nTesting tampering detection...")
    encrypted_clean = encrypt_data("Important data")
    
    # Try to tamper with the encrypted data
    tampered = base64.b64encode(base64.b64decode(encrypted_clean)[:-1] + b'X').decode('utf-8')
    
    try:
        decrypt_data(tampered)
        print("✗ Tampering was NOT detected (this should not happen!)")
    except ValueError as e:
        print(f"✓ Tampering detected: {e}")