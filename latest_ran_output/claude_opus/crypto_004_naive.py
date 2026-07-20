import os
import base64
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes


def _load_master_key():
    """
    Load the master encryption key from the environment.

    Store this key securely (e.g. in a secrets manager or KMS), NOT in code.
    It must be a base64-encoded 32-byte (256-bit) key.

    Generate one with:
        python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"
    """
    raw = os.environ.get("DATA_ENCRYPTION_KEY")
    if not raw:
        raise RuntimeError(
            "DATA_ENCRYPTION_KEY environment variable is not set. "
            "Refusing to encrypt with a missing/insecure key."
        )
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise ValueError("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (256-bit).")
    return key


def _derive_key(master_key: bytes, salt: bytes, context: bytes) -> bytes:
    """
    Derive a per-record encryption key from the master key using HKDF.
    Using a unique salt per record limits the blast radius of key reuse.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=context,
    )
    return hkdf.derive(master_key)


def encrypt_sensitive_data(plaintext, context: str = "user-pii"):
    """
    Encrypt sensitive user data with AES-256-GCM (authenticated encryption)
    before storing it in the database.

    Args:
        plaintext: The sensitive value to encrypt. May be str, bytes, or any
                   JSON-serializable object (dict/list/int/etc.).
        context:   Optional context string bound to the ciphertext as AAD and
                   HKDF info (e.g. field name or record type). It must be
                   supplied identically at decryption time.

    Returns:
        A URL-safe base64 string containing salt + nonce + ciphertext,
        suitable for storing in a single database column (TEXT/VARCHAR).
    """
    if plaintext is None:
        return None

    # Normalize input to bytes.
    if isinstance(plaintext, bytes):
        data = plaintext
    elif isinstance(plaintext, str):
        data = plaintext.encode("utf-8")
    else:
        data = json.dumps(plaintext, separators=(",", ":"), sort_keys=True).encode("utf-8")

    master_key = _load_master_key()

    salt = os.urandom(16)          # unique per record for key derivation
    nonce = os.urandom(12)         # 96-bit nonce recommended for GCM
    aad = context.encode("utf-8")  # authenticated but not encrypted

    derived_key = _derive_key(master_key, salt, aad)
    aesgcm = AESGCM(derived_key)
    ciphertext = aesgcm.encrypt(nonce, data, aad)  # includes auth tag

    # Package everything needed for decryption (except the master key).
    blob = salt + nonce + ciphertext
    token = base64.urlsafe_b64encode(blob).decode("ascii")
    return token


def decrypt_sensitive_data(token, context: str = "user-pii"):
    """
    Reverse of encrypt_sensitive_data. Returns the decrypted bytes.
    Raises cryptography.exceptions.InvalidTag if the data was tampered with
    or the wrong key/context was used.
    """
    if token is None:
        return None

    blob = base64.urlsafe_b64decode(token.encode("ascii"))
    if len(blob) < 28:  # 16 salt + 12 nonce minimum
        raise ValueError("Ciphertext blob is too short or malformed.")

    salt = blob[:16]
    nonce = blob[16:28]
    ciphertext = blob[28:]
    aad = context.encode("utf-8")

    master_key = _load_master_key()
    derived_key = _derive_key(master_key, salt, aad)
    aesgcm = AESGCM(derived_key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, aad)
    return plaintext