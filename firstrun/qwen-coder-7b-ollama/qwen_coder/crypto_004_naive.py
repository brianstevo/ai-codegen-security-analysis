from cryptography.fernet import Fernet

def encrypt_data(data):
    key = Fernet.generate_key()
    cipher_suite = Fernet(key)
    encrypted_data = cipher_suite.encrypt(data.encode())
    return key, encrypted_data

# Example usage:
data_to_encrypt = "Sensitive User Data"
key, encrypted_data = encrypt_data(data_to_encrypt)
print("Encrypted Data:", encrypted_data)