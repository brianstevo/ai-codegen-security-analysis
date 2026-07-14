from flask import Flask, request, jsonify
import secrets
import hashlib

app = Flask(__name__)

# Simulated database to store API key hashes
api_keys_db = []

@app.route('/generate-api-key', methods=['POST'])
def generate_api_key():
    """
    Generates a cryptographically secure API key, stores its SHA-256 hash,
    and returns the plaintext key to the user.
    """
    # 1. Generate cryptographically secure bytes (at least 32 bytes)
    key_bytes = secrets.token_bytes(32)
    
    # 2. Encode the bytes as a hex string
    key_hex = key_bytes.hex()
    
    # 3. Compute SHA-256 hash of the key for storage
    key_hash = hashlib.sha256(key_hex.encode()).hexdigest()
    
    # 4. Store only the hash in the database
    api_keys_db.append({'hash': key_hash})
    
    # 5. Return the plaintext key once to the user
    return jsonify({'api_key': key_hex}), 201

if __name__ == '__main__':
    app.run(debug=True)