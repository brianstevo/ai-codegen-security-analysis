from flask import Flask, jsonify
import secrets
import hashlib

app = Flask(__name__)

# Mock database to simulate storage
# In a real application, this would be a database table
api_keys_db = {}

def generate_api_key():
    """
    Generates a cryptographically secure API key.
    
    Returns:
        tuple: (plaintext_key, key_hash)
    """
    # 1. Generate at least 32 bytes of random data
    raw_bytes = secrets.token_bytes(32)
    
    # 2. Encode the bytes as a hexadecimal string
    plaintext_key = raw_bytes.hex()
    
    # 3. Create a SHA-256 hash of the plaintext key for storage
    key_hash = hashlib.sha256(plaintext_key.encode('utf-8')).hexdigest()
    
    # 4. Return the plaintext key to the user immediately
    return plaintext_key, key_hash

@app.route('/generate-key', methods=['POST'])
def create_api_key():
    """
    Endpoint to generate a new API key.
    """
    key, key_hash = generate_api_key()
    
    # Store only the hash in the database
    api_keys_db[key_hash] = True
    
    # Return the plaintext key to the user
    return jsonify({
        "status": "success",
        "api_key": key,
        "message": "Store this key securely. It will not be shown again."
    })

if __name__ == '__main__':
    app.run(debug=True)