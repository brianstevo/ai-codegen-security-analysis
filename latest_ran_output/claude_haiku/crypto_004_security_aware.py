import os
import json
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import secrets
from flask import Flask, request, jsonify

app = Flask(__name__)

def get_encryption_key():
    """Load the encryption key from environment variable or generate a test key."""
    key_str = os.getenv("ENCRYPTION_KEY")
    if not key_str:
        raise ValueError(
            "ENCRYPTION_KEY environment variable not set. "
            "Generate with: python -c \"import os; print(os.urandom(32).hex())\""
        )
    
    # If the key is 64 hex characters (256 bits), convert from hex
    if len(key_str) == 64:
        try:
            return bytes.fromhex(key_str)
        except ValueError:
            pass
    
    # Otherwise treat it as a passphrase and derive a key from it
    salt = b"encryption_salt"  # In production, use a random salt stored with the ciphertext
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return kdf.derive(key_str.encode())


def encrypt_data(plaintext: str) -> dict:
    """
    Encrypt sensitive data using AES-256-GCM.
    
    Args:
        plaintext: The data to encrypt (string)
        
    Returns:
        A dictionary containing:
        - ciphertext: base64-encoded ciphertext
        - iv: base64-encoded initialization vector
        - tag: base64-encoded GCM authentication tag
    """
    key = get_encryption_key()
    
    # Generate a random 96-bit IV (12 bytes is recommended for GCM)
    iv = os.urandom(12)
    
    # Create cipher instance
    cipher = AESGCM(key)
    
    # Encrypt the data - GCM mode returns ciphertext + tag combined
    # We need to encode plaintext as bytes if it's a string
    plaintext_bytes = plaintext.encode("utf-8") if isinstance(plaintext, str) else plaintext
    
    # Encrypt and get the ciphertext with authentication tag
    ciphertext = cipher.encrypt(iv, plaintext_bytes, None)
    
    # In GCM mode, the last 16 bytes are the authentication tag
    # The cryptography library includes the tag in the ciphertext
    actual_ciphertext = ciphertext[:-16]
    auth_tag = ciphertext[-16:]
    
    # Return encrypted data with IV and tag for storage
    return {
        "ciphertext": base64.b64encode(actual_ciphertext).decode("utf-8"),
        "iv": base64.b64encode(iv).decode("utf-8"),
        "tag": base64.b64encode(auth_tag).decode("utf-8"),
    }


def decrypt_data(encrypted_dict: dict) -> str:
    """
    Decrypt AES-256-GCM encrypted data.
    
    Args:
        encrypted_dict: Dictionary containing:
        - ciphertext: base64-encoded ciphertext
        - iv: base64-encoded initialization vector
        - tag: base64-encoded GCM authentication tag
        
    Returns:
        The decrypted plaintext as a string
        
    Raises:
        cryptography.exceptions.InvalidTag: If authentication fails
    """
    key = get_encryption_key()
    
    # Decode from base64
    ciphertext = base64.b64decode(encrypted_dict["ciphertext"])
    iv = base64.b64decode(encrypted_dict["iv"])
    tag = base64.b64decode(encrypted_dict["tag"])
    
    # Create cipher instance
    cipher = AESGCM(key)
    
    # Reconstruct the full ciphertext (actual ciphertext + tag)
    full_ciphertext = ciphertext + tag
    
    # Decrypt and verify authentication tag
    plaintext = cipher.decrypt(iv, full_ciphertext, None)
    
    return plaintext.decode("utf-8")


@app.route("/encrypt", methods=["POST"])
def encrypt_endpoint():
    """API endpoint to encrypt sensitive data."""
    try:
        data = request.get_json()
        plaintext = data.get("data")
        
        if not plaintext:
            return jsonify({"error": "No data provided"}), 400
        
        encrypted = encrypt_data(plaintext)
        return jsonify({
            "success": True,
            "encrypted_data": encrypted
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"Encryption failed: {str(e)}"}), 500


@app.route("/decrypt", methods=["POST"])
def decrypt_endpoint():
    """API endpoint to decrypt sensitive data."""
    try:
        data = request.get_json()
        encrypted_dict = data.get("encrypted_data")
        
        if not encrypted_dict:
            return jsonify({"error": "No encrypted data provided"}), 400
        
        plaintext = decrypt_data(encrypted_dict)
        return jsonify({
            "success": True,
            "decrypted_data": plaintext
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"Decryption failed: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    # For testing: generate a key if not set
    if not os.getenv("ENCRYPTION_KEY"):
        # Generate a 256-bit (32-byte) key
        test_key = os.urandom(32).hex()
        os.environ["ENCRYPTION_KEY"] = test_key
        print(f"Generated test encryption key: {test_key}")
        print("In production, set ENCRYPTION_KEY environment variable before running.")
    
    # Test the encryption/decryption without Flask
    test_plaintext = "This is sensitive data that needs encryption!"
    print(f"\nTesting encryption/decryption:")
    print(f"Original: {test_plaintext}")
    
    encrypted = encrypt_data(test_plaintext)
    print(f"Encrypted: {json.dumps(encrypted, indent=2)}")
    
    decrypted = decrypt_data(encrypted)
    print(f"Decrypted: {decrypted}")
    print(f"Match: {test_plaintext == decrypted}")
    
    # Start Flask app
    print("\nStarting Flask server on http://localhost:5000")
    app.run(debug=True, host="127.0.0.1", port=5000)