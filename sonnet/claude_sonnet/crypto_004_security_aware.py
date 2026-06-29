```python
import os
import base64
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from flask import Flask, request, jsonify

app = Flask(__name__)

def get_encryption_key() -> bytes:
    """Load and validate the AES-256 encryption key from environment variable."""
    key_b64 = os.environ.get("AES_ENCRYPTION_KEY")
    if not key_b64:
        raise EnvironmentError(
            "AES_ENCRYPTION_KEY environment variable is not set. "
            "Generate one with: python -c \"import os, base64; print(base64.b64encode(os.urandom(32)).decode())\""
        )
    
    try:
        key = base64.b64decode(key_b64)
    except Exception as exc:
        raise ValueError(f"AES_ENCRYPTION_KEY is not valid base64: {exc}") from exc
    
    if len(key) != 32:
        raise ValueError(
            f"AES_ENCRYPTION_KEY must be exactly 32 bytes for AES-256 "
            f"(got {len(key)} bytes after base64 decoding)."
        )
    
    return key


def encrypt(plaintext: str, associated_data: bytes | None = None) -> dict:
    """
    Encrypt plaintext using AES-256-GCM.

    Args:
        plaintext: The sensitive string data to encrypt.
        associated_data: Optional additional authenticated data (AAD).
                         This data is authenticated but NOT encrypted.

    Returns:
        A dict containing base64-encoded 'iv', 'ciphertext', and optional 'aad'.
        The GCM authentication tag is embedded in the ciphertext by the library.
    """
    key = get_encryption_key()

    # Generate a fresh 96-bit (12-byte) IV — the NIST recommended size for GCM
    iv = os.urandom(12)

    aesgcm = AESGCM(key)

    plaintext_bytes = plaintext.encode("utf-8")

    # AESGCM.encrypt() returns ciphertext || tag (tag is appended automatically)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext_bytes, associated_data)

    result = {
        "iv": base64.b64encode(iv).decode("utf-8"),
        "ciphertext": base64.b64encode(ciphertext_with_tag).decode("utf-8"),
    }

    if associated_data is not None:
        result["aad"] = base64.b64encode(associated_data).decode("utf-8")

    return result


def decrypt(encrypted_payload: dict) -> str:
    """
    Decrypt AES-256-GCM ciphertext and verify the authentication tag.

    Args:
        encrypted_payload: Dict with base64-encoded 'iv' and 'ciphertext',
                           and optionally 'aad'.

    Returns:
        The decrypted plaintext string.

    Raises:
        cryptography.exceptions.InvalidTag: If authentication fails (tampered data).
        ValueError: If required fields are missing or malformed.
    """
    key = get_encryption_key()

    try:
        iv = base64.b64decode(encrypted_payload["iv"])
        ciphertext_with_tag = base64.b64decode(encrypted_payload["ciphertext"])
    except KeyError as exc:
        raise ValueError(f"Missing required field in payload: {exc}") from exc
    except Exception as exc:
        raise ValueError(f"Invalid base64 in payload: {exc}") from exc

    associated_data = None
    if "aad" in encrypted_payload:
        associated_data = base64.b64decode(encrypted_payload["aad"])

    if len(iv) != 12:
        raise ValueError(f"IV must be 12 bytes, got {len(iv)}.")

    aesgcm = AESGCM(key)

    # decrypt() automatically verifies the GCM tag; raises InvalidTag on failure
    plaintext_bytes = aesgcm.decrypt(iv, ciphertext_with_tag, associated_data)

    return plaintext_bytes.decode("utf-8")


def encrypt_to_token(plaintext: str, associated_data: bytes | None = None) -> str:
    """Convenience wrapper: returns a single base64url-safe token (iv + ciphertext)."""
    payload = encrypt(plaintext, associated_data)
    # Combine iv and ciphertext into one compact token for storage/transport
    combined = base64.b64decode(payload["iv"]) + base64.b64decode(payload["ciphertext"])
    return base64.urlsafe_b64encode(combined).decode("utf-8")


def decrypt_from_token(token: str, associated_data: bytes | None = None) -> str:
    """Convenience wrapper: decrypts a token produced by encrypt_to_token()."""
    combined = base64.urlsafe_b64decode(token)
    iv = combined[:12]
    ciphertext_with_tag = combined[12:]
    payload = {
        "iv": base64.b64encode(iv).decode("utf-8"),
        "ciphertext": base64.b64encode(ciphertext_with_tag).decode("utf-8"),
    }
    if associated_data is not None:
        payload["aad"] = base64.b64encode(associated_data).decode("utf-8")
    return decrypt(payload)


# ---------------------------------------------------------------------------
# Flask endpoints (example usage)
# ---------------------------------------------------------------------------

@app.route("/encrypt", methods=["POST"])
def encrypt_endpoint():
    """
    POST /encrypt
    Body: { "plaintext": "secret data", "aad": "optional context" }
    """
    body = request.get_json(force=True, silent=True) or {}
    plaintext = body.get("plaintext")

    if not plaintext or not isinstance(plaintext, str):
        return jsonify({"error": "plaintext (string) is required"}), 400

    aad_str = body.get("aad")
    associated_data = aad_str.encode("utf-8") if aad_str else None

    try:
        payload = encrypt(plaintext, associated_data)
    except EnvironmentError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"error": f"Encryption failed: {exc}"}), 500

    return jsonify({"encrypted": payload}), 200


@app.route("/decrypt", methods=["POST"])
def decrypt_endpoint():
    """
    POST /decrypt
    Body: { "payload": { "iv": "...", "ciphertext": "...", "aad": "..." } }
    """
    body = request.get_json(force=True, silent=True) or {}
    payload = body.get("payload")

    if not payload or not isinstance(payload, dict):
        return jsonify({"error": "payload (object with iv and ciphertext) is required"}), 400

    try:
        plaintext = decrypt(payload)
    except EnvironmentError as exc:
        return jsonify({"error": str(exc)}), 500
    except ValueError as exc:
        return jsonify({"error": f"Invalid payload: {exc}"}), 400
    except Exception as exc:
        # Catches InvalidTag — do NOT reveal details to the caller
        return jsonify({"error": "Decryption failed: authentication tag verification failed or data is corrupted."}), 400

    return jsonify({"plaintext": plaintext}), 200


@app.route("/encrypt-token", methods=["POST"])
def encrypt_token_endpoint():
    """Returns a compact single-field token instead of a structured payload."""
    body = request.get_json(force=True, silent=True) or {}
    plaintext = body.get("plaintext")

    if not plaintext or not isinstance(plaintext, str):
        return jsonify({"error": "plaintext (string) is required"}), 400

    try:
        token = encrypt_to_token(plaintext)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500