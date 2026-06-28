import os
import base64
from flask import Flask, request, jsonify
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

app = Flask(__name__)

def get_encryption_key():
    """
    Retrieves the encryption key from environment variables.
    The key should be a base64 encoded 32-byte string for AES-256.
    """
    key_b64 = os.environ.get("ENCRYPTION_KEY")
    if not key_b64:
        raise EnvironmentError("ENCRYPTION_KEY environment variable is not set.")
    
    # Decode the base64 string to get the raw 32 bytes
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be a base64 encoded 32-byte key.")
    return key

def encrypt_data(plaintext: str) -> str:
    """
    Encrypts sensitive data using AES-256-GCM.
    Returns a base64 encoded string containing the nonce and ciphertext (with auth tag).
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    
    # GCM standard nonce size is 12 bytes
    nonce = os.urandom(12)
    data_bytes = plaintext.encode('utf-8')
    
    # encrypt() returns ciphertext + auth tag
    ciphertext = aesgcm.encrypt(nonce, data_bytes, None)
    
    # Store nonce and ciphertext together: [nonce (12 bytes)][ciphertext + tag]
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode('utf-8')

def decrypt_data(encrypted_blob: str) -> str:
    """
    Decrypts data encrypted via encrypt_data.
    Validates the GCM auth tag before returning plaintext.
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    
    try:
        combined = base64.b64decode(encrypted_blob)
        if len(combined) < 28: # 12 (nonce) + 16 (min tag size)
            raise ValueError("Encrypted blob is too short.")
            
        # Split the nonce from the ciphertext/tag
        nonce = combined[:12]
        ciphertext = combined[12:]
        
        # decrypt() verifies the auth tag; raises InvalidTag if tampered with
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext_bytes.decode('utf-8')
    except (InvalidTag, ValueError) as e:
        raise PermissionError("Decryption failed: Data is corrupted or key is incorrect.") from e

@app.route('/encrypt', methods=['POST'])
def handle_encrypt():
    data = request.json.get('data')
    if not data:
        return jsonify({"error": "No data provided"}), 400
    try:
        encrypted = encrypt_data(data)
        return jsonify({"encrypted_data": encrypted})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/decrypt', methods=['POST'])
def handle_decrypt():
    blob = request.json.get('encrypted_data')
    if not blob:
        return jsonify({"error": "No encrypted data provided"}), 400
    try:
        decrypted = decrypt_data(blob)
        return jsonify({"decrypted_data": decrypted})
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        return jsonify({"error": "An internal error occurred"}), 500

if __name__ == "__main__":
    # To generate a valid key for the environment variable:
    # import base64, os; print(base64.b64encode(os.urandom(32)).decode())
    app.run(debug=True)