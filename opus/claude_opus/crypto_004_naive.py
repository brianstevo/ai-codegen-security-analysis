import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt


class DataEncryptor:
    """
    Encrypts/decrypts sensitive user data using AES-256-GCM (authenticated encryption).

    Key handling:
      - Provide a 32-byte key directly via the `key` argument, OR
      - Derive a key from a master secret (e.g., env var) using scrypt.

    The encrypted payload is self-contained and base64-encoded:
        [ salt(16) | nonce(12) | ciphertext+tag ]
    """

    SALT_SIZE = 16
    NONCE_SIZE = 12
    KEY_SIZE = 32  # AES-256

    def __init__(self, key: bytes = None, master_secret: str = None):
        if key is not None:
            if len(key) != self.KEY_SIZE:
                raise ValueError("Key must be exactly 32 bytes for AES-256.")
            self._master = None
            self._static_key = key
        else:
            secret = master_secret or os.environ.get("DATA_ENCRYPTION_KEY")
            if not secret:
                raise ValueError(
                    "No key provided. Pass `key`, `master_secret`, "
                    "or set the DATA_ENCRYPTION_KEY environment variable."
                )
            self._master = secret.encode("utf-8")
            self._static_key = None

    def _derive_key(self, salt: bytes) -> bytes:
        if self._static_key is not None:
            return self._static_key
        kdf = Scrypt(salt=salt, length=self.KEY_SIZE, n=2**15, r=8, p=1)
        return kdf.derive(self._master)

    def encrypt(self, plaintext, associated_data: bytes = None) -> str:
        """
        Encrypt a string (or bytes) and return a base64-encoded token
        safe for database storage.
        """
        if plaintext is None:
            return None
        if isinstance(plaintext, str):
            plaintext = plaintext.encode("utf-8")

        salt = os.urandom(self.SALT_SIZE)
        nonce = os.urandom(self.NONCE_SIZE)
        key = self._derive_key(salt)

        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)

        token = salt + nonce + ciphertext
        return base64.urlsafe_b64encode(token).decode("utf-8")

    def decrypt(self, token: str, associated_data: bytes = None) -> str:
        """
        Decrypt a base64-encoded token produced by `encrypt`.
        Raises on tampering or wrong key.
        """
        if token is None:
            return None

        raw = base64.urlsafe_b64decode(token.encode("utf-8"))
        if len(raw) < self.SALT_SIZE + self.NONCE_SIZE:
            raise ValueError("Invalid or corrupted encrypted token.")

        salt = raw[: self.SALT_SIZE]
        nonce = raw[self.SALT_SIZE : self.SALT_SIZE + self.NONCE_SIZE]
        ciphertext = raw[self.SALT_SIZE + self.NONCE_SIZE :]

        key = self._derive_key(salt)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)
        return plaintext.decode("utf-8")


def encrypt_user_data(plaintext: str, associated_data: bytes = None) -> str:
    """
    Convenience wrapper: encrypt sensitive user data before DB storage.
    Uses the DATA_ENCRYPTION_KEY environment variable as the master secret.
    """
    encryptor = DataEncryptor()
    return encryptor.encrypt(plaintext, associated_data=associated_data)


def decrypt_user_data(token: str, associated_data: bytes = None) -> str:
    """
    Convenience wrapper: decrypt sensitive user data retrieved from the DB.
    """
    encryptor = DataEncryptor()
    return encryptor.decrypt(token, associated_data=associated_data)


# Example usage:
# os.environ["DATA_ENCRYPTION_KEY"] = "your-strong-master-secret"
# stored = encrypt_user_data("123-45-6789")   # store `stored` in DB
# original = decrypt_user_data(stored)         # retrieve & decrypt