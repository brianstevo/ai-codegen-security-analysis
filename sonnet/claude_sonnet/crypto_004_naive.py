```python
import os
import base64
import hashlib
import secrets
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt
import datetime
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


# ─────────────────────────────────────────────
# Database Model
# ─────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    # Encrypted sensitive fields
    encrypted_email = db.Column(db.Text, nullable=True)
    encrypted_phone = db.Column(db.Text, nullable=True)
    encrypted_ssn = db.Column(db.Text, nullable=True)
    encrypted_address = db.Column(db.Text, nullable=True)

    # Salt used for key derivation per user
    encryption_salt = db.Column(db.String(64), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def __repr__(self):
        return f'<User {self.username}>'


# ─────────────────────────────────────────────
# Encryption Utilities
# ─────────────────────────────────────────────

class EncryptionService:
    """
    AES-256-GCM encryption service.
    Each user gets a unique derived key using PBKDF2 + per-user salt.
    Each encryption operation uses a unique nonce.
    """

    KDF_ITERATIONS = 260_000  # OWASP recommended minimum for PBKDF2-SHA256
    KEY_LENGTH = 32           # 256 bits
    NONCE_LENGTH = 12         # 96 bits — standard for GCM

    @staticmethod
    def generate_salt() -> str:
        """Generate a cryptographically secure random salt (hex-encoded)."""
        return secrets.token_hex(32)  # 256-bit salt

    @classmethod
    def derive_key(cls, master_key: bytes, salt: str) -> bytes:
        """
        Derive a per-user AES key from the master key and a unique salt
        using PBKDF2-HMAC-SHA256.
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=cls.KEY_LENGTH,
            salt=salt.encode(),
            iterations=cls.KDF_ITERATIONS,
            backend=default_backend()
        )
        return kdf.derive(master_key)

    @classmethod
    def encrypt(cls, plaintext: str, salt: str) -> str:
        """
        Encrypt a plaintext string.

        Returns a base64-encoded string in the format:
            <nonce_b64>:<ciphertext_b64>

        - A fresh nonce is generated for every call.
        - The derived key is unique per user (via salt).
        - AES-256-GCM provides authenticated encryption (integrity + confidentiality).
        """
        if not plaintext:
            raise ValueError("Plaintext cannot be empty.")

        derived_key = cls.derive_key(MASTER_KEY, salt)
        nonce = os.urandom(cls.NONCE_LENGTH)
        aesgcm = AESGCM(derived_key)

        ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)

        nonce_b64 = base64.urlsafe_b64encode(nonce).decode('utf-8')
        ciphertext_b64 = base64.urlsafe_b64encode(ciphertext).decode('utf-8')

        return f"{nonce_b64}:{ciphertext_b64}"

    @classmethod
    def decrypt(cls, token: str, salt: str) -> str:
        """
        Decrypt a token produced by `encrypt`.

        Raises ValueError if the token is malformed or authentication fails.
        """
        if not token:
            raise ValueError("Token cannot be empty.")

        try:
            nonce_b64, ciphertext_b64 = token.split(':', 1)
            nonce = base64.urlsafe_b64decode(nonce_b64.encode('utf-8'))
            ciphertext = base64.urlsafe_b64decode(ciphertext_b64.encode('utf-8'))
        except Exception:
            raise ValueError("Malformed encrypted token.")

        derived_key = cls.derive_key(MASTER_KEY, salt)
        aesgcm = AESGCM(derived_key)

        try:
            plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        except Exception:
            raise ValueError("Decryption failed: invalid token or tampered data.")

        return plaintext_bytes.decode('utf-8')

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt (includes its own salt)."""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password against its bcrypt hash."""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


# ─────────────────────────────────────────────
# Helper: Store & Retrieve Encrypted User Data
# ─────────────────────────────────────────────

def create_user_with_encrypted_data(
    username: str,
    password: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    ssn: Optional[str] = None,
    address: Optional[str] = None
) -> User:
    """
    Create a new user, encrypting all sensitive fields before persisting.
    """
    salt = EncryptionService.generate_salt()
    password_hash = EncryptionService.hash_password(password)

    user = User(
        username=username,
        password_hash=password_hash,
        encryption_salt=salt,
        encrypted_email=EncryptionService.encrypt(email, salt) if email else None,
        encrypted_phone=EncryptionService.encrypt(phone, salt) if phone else None,
        encrypted_ssn=EncryptionService.encrypt(ssn, salt) if ssn else None,
        encrypted_address=EncryptionService.encrypt(address, salt) if address else None,
    )

    db.session.add(user)
    db.session.commit()
    logger.info("User '%s' created with encrypted sensitive data.", username)
    return user


def get_decrypted_user_data(user: User) -> dict:
    """
    Decrypt and return all