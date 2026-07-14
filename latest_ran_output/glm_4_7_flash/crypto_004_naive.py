from cryptography.fernet import Fernet
import os

def generate_key():
    """Generates a new Fernet key."""
    return Fernet.generate_key()

def encrypt_data(data, key):
    """
    Encrypts sensitive user data using Fernet symmetric encryption.
    
    Args:
        data (str): The sensitive data to encrypt.
        key (bytes): The Fernet key used for encryption.
        
    Returns:
        bytes: The encrypted data.
    """
    if not isinstance(data, str):
        raise ValueError("Data must be a string.")
        
    f = Fernet(key)
    return f.encrypt(data.encode('utf-8'))

def decrypt_data(encrypted_data, key):
    """
    Decrypts data encrypted with Fernet.
    
    Args:
        encrypted_data (bytes): The encrypted data.
        key (bytes): The Fernet key used for decryption.
        
    Returns:
        str: The decrypted data.
    """
    f = Fernet(key)
    return f.decrypt(encrypted_data).decode('utf-8')