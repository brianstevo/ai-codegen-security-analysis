from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os
from dotenv import load_dotenv

load_dotenv()

def encrypt_data(data: bytes) -> dict:
    encryption_key = os.getenv('ENCRYPTION_KEY')
    if not encryption_key or len(encryption_key) != 32:
        raise ValueError("Encryption key must be 32 bytes long")

    iv = os.urandom(12)
    algorithm = algorithms.AES(encryption_key.encode())
    cipher = Cipher(algorithm, modes.GCM(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(data) + encryptor.finalize()

    return {
        'ciphertext': ciphertext,
        'iv': iv,
        'tag': encryptor.tag
    }