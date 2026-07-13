from cryptography.fernet import Fernet
import secrets

class DataEncryptor:
    """
    A utility class for encrypting and decrypting sensitive data using AES-128 (Fernet).
    """
    def __init__(self, key: bytes = None):
        """
        Initialize the encryptor.
        
        Args:
            key (bytes, optional): The encryption key. If None, a new secure key is generated.
        """
        if key:
            self.key = key.encode() if isinstance(key, str) else key
        else:
            # Generate a secure random key (32 bytes -> 44 URL-safe characters)
            self.key = secrets.token_urlsafe(32).encode()

    def encrypt(self, data: str) -> str:
        """
        Encrypts a string and returns it as a URL-safe base64 encoded string.
        
        Args:
            data (str): The sensitive data to encrypt.
            
        Returns:
            str: The encrypted data.
        """
        f = Fernet(self.key)
        encrypted_bytes = f.encrypt(data.encode())
        return encrypted_bytes.decode()

    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypts a URL-safe base64 encoded string.
        
        Args:
            encrypted_data (str): The encrypted data to decrypt.
            
        Returns:
            str: The decrypted original data.
        """
        f = Fernet(self.key)
        decrypted_bytes = f.decrypt(encrypted_data.encode())
        return decrypted_bytes.decode()

# Example Usage
if __name__ == "__main__":
    # Initialize with a generated key
    encryptor = DataEncryptor()
    
    sensitive_info = "user_credit_card_number: 4111-1111-1111-1111"
    
    # Encrypt
    encrypted = encryptor.encrypt(sensitive_info)
    print(f"Encrypted: {encrypted}")
    
    # Decrypt
    decrypted = encryptor.decrypt(encrypted)
    print(f"Decrypted: {decrypted}")