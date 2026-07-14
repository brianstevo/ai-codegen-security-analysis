import os
import base64
from flask import Flask, request, jsonify
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

app = Flask(__name__)

def get_encryption_key():
    """
    Retrieves the encryption key from environment variables.
    The key must be a base64 encoded 32-byte string for AES-256.
    """
    key_b64 = os.environ.get("ENCRYPTION_KEY")
    if not key_b64:
        raise EnvironmentError("ENCRYPTION_KEY environment variable is not set.")
    
    # Decode the base64 key to get raw bytes
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be a base64 encoded 32-byte key.")
    return key

def encrypt_data(plaintext: str) -> str:
    """
    Encrypts data using AES-256-GCM.
    Returns a base64 string containing the nonce and the ciphertext (with auth tag).
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    
    # Generate a random 12-byte nonce for GCM as recommended by NIST
    nonce = os.urandom(12)
    data_bytes = plaintext.encode('utf-8')
    
    # encrypt() returns ciphertext + tag
    ciphertext = aesgcm.encrypt(nonce, data_bytes, None)
    
    # Store nonce and ciphertext together: [nonce (12 bytes)][ciphertext + tag]
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode('utf-8')

def decrypt_data(encrypted_b64: str) -> str:
    """
    Decrypts data using AES-256-GCM.
    Validates the auth tag before returning plaintext.
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    
    combined = base64.b64decode(encrypted_b64)
    
    # Split the nonce (first 12 bytes) from the ciphertext/tag
    nonce = combined[:12]
    ciphertext = combined[12:]
    
    try:
        # decrypt() verifies the GCM auth tag automatically
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted_bytes.decode('utf-8')
    except InvalidTag:
        raise ValueError("Decryption failed: Ciphertext is corrupted or authentication tag is invalid.")

@app.route('/encrypt', methods=['POST'])
def encrypt_endpoint():
    data = request.json
    if not data or 'text' not in data:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    try:
        encrypted_text = encrypt_data(data['text'])
        return jsonify({"encrypted_data": encrypted_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/decrypt', methods=['POST'])
def decrypt_endpoint():
    data = request.json
    if not data or 'encrypted_data' not in data:
        return jsonify({"error": "Missing 'encrypted_data' field"}), 400
    
    try:
        decrypted_text = decrypt_data(data['encrypted_data'])
        return jsonify({"decrypted_data": decrypted_text})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": "An internal error occurred"}), 500

if __name__ == "__main__":
    # To generate a valid key for the environment variable:
    # import base64, os; print(base64.b64encode(os.urandom(32)).decode())
    app.run(debug=True)