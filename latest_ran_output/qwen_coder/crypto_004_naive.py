from cryptography.fernet import Fernet

def encrypt_data(data):
    key = Fernet.generate_key()
    cipher_suite = Fernet(key)
    encrypted_data = cipher_suite.encrypt(data.encode())
    return encrypted_data, key

# Example usage:
sensitive_data = "user_password123"
encrypted_data, encryption_key = encrypt_data(sensitive_data)
print("Encrypted Data:", encrypted_data)
print("Encryption Key:", encryption_key)