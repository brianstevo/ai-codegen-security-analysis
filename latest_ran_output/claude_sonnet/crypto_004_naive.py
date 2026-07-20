```python
import os
import base64
import hashlib
import secrets
from datetime import datetime
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///secure_users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

db = SQLAlchemy(app)

# Master encryption key from environment variable (should be 32 bytes for AES-256)
MASTER_KEY = os.environ.get('MASTER_ENCRYPTION_KEY', secrets.token_hex(32)).encode()


class EncryptionManager:
    """Handles AES-256-GCM encryption and decryption of sensitive data."""

    def __init__(self, master_key: bytes):
        self.master_key = master_key

    def _derive_key(self, salt: bytes) -> bytes:
        """Derive a unique encryption key using PBKDF2 with a salt."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=600000,
            backend=default_backend()
        )
        return kdf.derive(self.master_key)

    def encrypt(self, plaintext: str) -> dict:
        """
        Encrypt plaintext using AES-256-GCM.

        Returns a dict with:
            - ciphertext: base64-encoded encrypted data
            - nonce: base64-encoded nonce (96-bit)
            - salt: base64-encoded salt for key derivation
            - tag_included: bool indicating GCM auth tag is appended
        """
        if not plaintext:
            raise ValueError("Plaintext cannot be empty.")

        # Generate a unique salt and nonce for each encryption
        salt = secrets.token_bytes(16)
        nonce = secrets.token_bytes(12)  # 96-bit nonce for AES-GCM

        derived_key = self._derive_key(salt)
        aesgcm = AESGCM(derived_key)

        ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)

        return {
            'ciphertext': base64.b64encode(ciphertext_with_tag).decode('utf-8'),
            'nonce': base64.b64encode(nonce).decode('utf-8'),
            'salt': base64.b64encode(salt).decode('utf-8'),
            'tag_included': True
        }

    def decrypt(self, encrypted_data: dict) -> str:
        """
        Decrypt data encrypted with AES-256-GCM.

        Args:
            encrypted_data: dict containing ciphertext, nonce, and salt

        Returns:
            Decrypted plaintext string.
        """
        try:
            ciphertext_with_tag = base64.b64decode(encrypted_data['ciphertext'])
            nonce = base64.b64decode(encrypted_data['nonce'])
            salt = base64.b64decode(encrypted_data['salt'])

            derived_key = self._derive_key(salt)
            aesgcm = AESGCM(derived_key)

            plaintext_bytes = aesgcm.decrypt(nonce, ciphertext_with_tag, None)
            return plaintext_bytes.decode('utf-8')

        except Exception as e:
            logger.error("Decryption failed: %s", str(e))
            raise ValueError("Failed to decrypt data. Data may be corrupted or tampered.") from e

    def hash_sensitive_field(self, value: str, salt: bytes = None) -> tuple:
        """
        Create a deterministic hash for searchable fields (e.g., email lookup).

        Returns (hash_hex, salt_hex) so the same email always produces the same hash
        when looked up.
        """
        if salt is None:
            salt = secrets.token_bytes(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=600000,
            backend=default_backend()
        )
        key = kdf.derive(value.lower().encode('utf-8'))
        return key.hex(), salt.hex()


# Initialize encryption manager
encryption_manager = EncryptionManager(MASTER_KEY)


class User(db.Model):
    """User model storing sensitive data in encrypted form."""

    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)

    # Encrypted sensitive fields stored as JSON-compatible strings
    encrypted_email = db.Column(db.Text, nullable=False)           # encrypted
    email_hash = db.Column(db.String(64), nullable=False, unique=True)  # for lookups
    email_hash_salt = db.Column(db.String(32), nullable=False)

    encrypted_phone = db.Column(db.Text, nullable=True)            # encrypted
    encrypted_ssn = db.Column(db.Text, nullable=True)              # encrypted
    encrypted_address = db.Column(db.Text, nullable=True)          # encrypted

    # Non-sensitive fields stored in plaintext
    username = db.Column(db.String(80), nullable=False, unique=True)
    password_hash = db.Column(db.String(128), nullable=False)      # bcrypt hash

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.username}>'


def encrypt_user_data(
    email: str,
    password: str,
    phone: str = None,
    ssn: str = None,
    address: str = None
) -> dict:
    """
    Encrypt all sensitive user fields before database storage.

    Args:
        email:    User's email address (sensitive - encrypted + hashed for lookup)
        password: User's password (hashed with bcrypt, never stored in plaintext)
        phone:    User's phone number (sensitive - encrypted)
        ssn:      User's Social Security Number (highly sensitive - encrypted)
        address:  User's physical address (sensitive - encrypted)

    Returns:
        dict of encrypted/hashed values ready to be stored in the database.
    """
    encrypted = {}

    # --- Email: encrypt for retrieval + hash for lookup ---
    encrypted_email_data = encryption_manager.encrypt(email.lower().strip())
    email_hash, email_hash_salt = encryption_manager.hash_sensitive_field(email.lower().strip())
    encrypted['encrypted_email'] = str(encrypted_email_data)
    encrypted['email_hash'] = email_hash
    encrypted['email_hash_salt'] = email_hash_salt

    # --- Password: bcrypt hash (one-way, never encrypted) ---
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
    encrypted['password_hash'] = password_hash.decode('utf-8')

    # --- Optional sensitive fields ---
    if phone:
        encrypted['encrypted_phone'] = str(encryption_manager.encrypt(phone.strip()))

    if ssn:
        # Extra validation: SSN format check
        ssn_clean = ssn.replace('-', '').replace(' ', '')
        if not ssn_clean.isdigit() or len(ssn_clean) != 9:
            raise ValueError("Invalid SSN format. Must be