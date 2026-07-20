```python
import os
import base64
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from flask import Flask, request, jsonify

app = Flask(__name__)

# Constants
IV_LENGTH = 12       # 96 bits recommended for GCM
TAG_LENGTH = 16      # 128 bits (default for GCM)
KEY_ENV_VAR = "AES_ENCRYPTION_KEY"


def load_encryption_key() -> bytes:
    """
    Load the AES-256 encryption key from an environment variable.
    The key must be a base64-encoded 32-byte (256-bit) value.
    
    To generate a key:
        python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
    Then set it:
        export AES_ENCRYPTION_KEY="<generated_base64_key>"
    """
    raw_key = os.environ.get(KEY_ENV_VAR)
    if not raw_key:
        raise EnvironmentError(
            f"Encryption key not found. Set the '{KEY_ENV_VAR}' environment variable "
            "with a base64-encoded 32-byte key."
        )

    try:
        key = base64.b64decode(raw_key)
    except Exception as exc:
        raise ValueError(f"Failed to decode the encryption key: {exc}") from exc

    if len(key) != 32:
        raise ValueError(
            f"Invalid key length: {len(key)} bytes. AES-256 requires exactly 32 bytes."
        )

    return key


def encrypt(plaintext: str, aad: bytes | None = None) -> dict:
    """
    Encrypt plaintext using AES-256-GCM.

    Args:
        plaintext: The string data to encrypt.
        aad:       Optional additional authenticated data (not encrypted, but authenticated).

    Returns:
        A dict with base64-encoded 'iv', 'ciphertext_with_tag' (ciphertext + GCM tag),
        and optionally 'aad'.
        The GCM authentication tag is appended to the ciphertext by the cryptography library.

    Raises:
        EnvironmentError: If the encryption key is not set.
        ValueError:       If the key is invalid.
    """
    key = load_encryption_key()
    aesgcm = AESGCM(key)

    # Generate a fresh random IV for every encryption operation (never reuse IVs)
    iv = os.urandom(IV_LENGTH)

    plaintext_bytes = plaintext.encode("utf-8")

    # AESGCM.encrypt returns ciphertext || tag (tag appended automatically)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext_bytes, aad)

    result = {
        "iv": base64.b64encode(iv).decode("utf-8"),
        "ciphertext_with_tag": base64.b64encode(ciphertext_with_tag).decode("utf-8"),
    }

    if aad is not None:
        result["aad"] = base64.b64encode(aad).decode("utf-8")

    return result


def decrypt(encrypted_payload: dict) -> str:
    """
    Decrypt and authenticate an AES-256-GCM encrypted payload.

    Args:
        encrypted_payload: Dict with base64-encoded 'iv' and 'ciphertext_with_tag',
                           and optionally 'aad'.

    Returns:
        The original plaintext string.

    Raises:
        cryptography.exceptions.InvalidTag: If authentication fails (tampered data).
        EnvironmentError: If the encryption key is not set.
        ValueError:       If the key or payload is invalid.
    """
    key = load_encryption_key()
    aesgcm = AESGCM(key)

    try:
        iv = base64.b64decode(encrypted_payload["iv"])
        ciphertext_with_tag = base64.b64decode(encrypted_payload["ciphertext_with_tag"])
        aad_b64 = encrypted_payload.get("aad")
        aad = base64.b64decode(aad_b64) if aad_b64 else None
    except (KeyError, Exception) as exc:
        raise ValueError(f"Invalid encrypted payload structure: {exc}") from exc

    if len(iv) != IV_LENGTH:
        raise ValueError(f"Invalid IV length: {len(iv)} bytes. Expected {IV_LENGTH} bytes.")

    # AESGCM.decrypt verifies the GCM tag automatically; raises InvalidTag if authentication fails
    plaintext_bytes = aesgcm.decrypt(iv, ciphertext_with_tag, aad)
    return plaintext_bytes.decode("utf-8")


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/encrypt", methods=["POST"])
def encrypt_endpoint():
    """
    POST /encrypt
    Body (JSON): { "plaintext": "...", "aad": "optional string" }
    Returns: { "iv": "...", "ciphertext_with_tag": "...", "aad": "..." }
    """
    data = request.get_json(silent=True)
    if not data or "plaintext" not in data:
        return jsonify({"error": "Missing 'plaintext' in request body."}), 400

    plaintext = data["plaintext"]
    aad_str = data.get("aad")
    aad = aad_str.encode("utf-8") if aad_str else None

    try:
        payload = encrypt(plaintext, aad=aad)
    except EnvironmentError as exc:
        return jsonify({"error": str(exc)}), 500
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(payload), 200


@app.route("/decrypt", methods=["POST"])
def decrypt_endpoint():
    """
    POST /decrypt
    Body (JSON): { "iv": "...", "ciphertext_with_tag": "...", "aad": "optional" }
    Returns: { "plaintext": "..." }
    """
    data = request.get_json(silent=True)
    if not data or "iv" not in data or "ciphertext_with_tag" not in data:
        return jsonify({"error": "Missing 'iv' or 'ciphertext_with_tag' in request body."}), 400

    try:
        plaintext = decrypt(data)
    except EnvironmentError as exc:
        return jsonify({"error": str(exc)}), 500
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        # Covers cryptography.exceptions.InvalidTag and other auth failures
        return jsonify({"error": "Decryption failed: authentication tag mismatch or corrupted data."}), 400

    return jsonify({"plaintext": plaintext}), 200


@app.route("/health", methods=["GET"])
def health():
    """Simple health-check endpoint."""
    return jsonify({"status": "ok"}), 200


# ---------------------------------------------------------------------------
# Example usage (standalone, outside Flask)
# ---------------------------------------------------------------------------

def _demo():
    """Quick demonstration of encrypt/decrypt without a running server."""
    # Simulate setting the environment variable for demonstration only
    # In production, set this OUTSIDE the application code
    if not os.environ.get(KEY_ENV_VAR):
        demo_key = base64.b64encode(os.urandom(32)).decode()
        os.environ[KEY_ENV_VAR] = demo_key
        print(f"[demo] Generated ephemeral key (base64): {demo_key}")

    sensitive_data = "Top-secret payload: user SSN = 123-45-6789"
    additional_data = b"user-id:42"   # authenticated but NOT encrypted

    print(f"\n[demo] Original plaintext : {sensitive_data}")

    encrypted = encrypt(sensitive_data, aad=additional_data)
    print(f"[demo] IV                 : {encrypted['iv']}")
    print(f"[demo] Ciphertext+