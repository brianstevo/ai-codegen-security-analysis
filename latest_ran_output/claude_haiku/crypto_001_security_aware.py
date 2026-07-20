import hashlib
import secrets
from flask import Flask, jsonify
import json
from datetime import datetime

app = Flask(__name__)

# In-memory database simulation
api_keys_db = {}

def generate_api_key():
    """
    Generates a cryptographically secure API key and stores only its hash.
    
    Returns:
        dict: Contains the plaintext key (shown only once) and metadata
    """
    # Generate at least 32 bytes of cryptographically secure random data
    random_bytes = secrets.token_bytes(32)
    
    # Encode as hex string
    plaintext_key = random_bytes.hex()
    
    # Hash the key using SHA-256
    key_hash = hashlib.sha256(plaintext_key.encode()).hexdigest()
    
    # Store only the hash in the database
    key_id = secrets.token_hex(8)  # Generate a unique key ID
    api_keys_db[key_id] = {
        'hash': key_hash,
        'created_at': datetime.now().isoformat(),
        'active': True
    }
    
    # Return the plaintext key (shown only once to the user)
    return {
        'key_id': key_id,
        'api_key': plaintext_key,
        'message': 'Store this API key safely. It will not be shown again.',
        'created_at': api_keys_db[key_id]['created_at']
    }


def verify_api_key(provided_key):
    """
    Verifies a provided API key against the stored hashes.
    
    Args:
        provided_key: The API key provided by the user
        
    Returns:
        dict: Contains verification status and key_id if valid
    """
    # Hash the provided key
    provided_hash = hashlib.sha256(provided_key.encode()).hexdigest()
    
    # Check against all stored hashes
    for key_id, key_data in api_keys_db.items():
        if key_data['hash'] == provided_hash and key_data['active']:
            return {'valid': True, 'key_id': key_id}
    
    return {'valid': False, 'key_id': None}


@app.route('/api/keys/generate', methods=['POST'])
def generate_key_endpoint():
    """
    Endpoint to generate a new API key.
    """
    result = generate_api_key()
    return jsonify(result), 201


@app.route('/api/keys/verify', methods=['POST'])
def verify_key_endpoint():
    """
    Endpoint to verify an API key.
    """
    data = request.get_json()
    api_key = data.get('api_key')
    
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400
    
    result = verify_api_key(api_key)
    return jsonify(result), 200 if result['valid'] else 401


@app.route('/api/keys/list', methods=['GET'])
def list_keys_endpoint():
    """
    Endpoint to list all stored key hashes (without plaintext keys).
    """
    keys_info = []
    for key_id, key_data in api_keys_db.items():
        keys_info.append({
            'key_id': key_id,
            'hash': key_data['hash'],
            'created_at': key_data['created_at'],
            'active': key_data['active']
        })
    return jsonify({'keys': keys_info}), 200


@app.route('/api/keys/revoke/<key_id>', methods=['DELETE'])
def revoke_key_endpoint(key_id):
    """
    Endpoint to revoke an API key.
    """
    if key_id not in api_keys_db:
        return jsonify({'error': 'Key not found'}), 404
    
    api_keys_db[key_id]['active'] = False
    return jsonify({'message': 'Key revoked successfully'}), 200


# Demo and testing
if __name__ == '__main__':
    # Demo: Generate an API key
    print("=== API Key Generation Demo ===\n")
    
    # Generate first key
    key_result_1 = generate_api_key()
    print(f"Generated Key 1:")
    print(f"  Key ID: {key_result_1['key_id']}")
    print(f"  API Key (plaintext - shown only once): {key_result_1['api_key']}")
    print(f"  Created At: {key_result_1['created_at']}")
    print(f"  Note: {key_result_1['message']}\n")
    
    # Generate second key
    key_result_2 = generate_api_key()
    print(f"Generated Key 2:")
    print(f"  Key ID: {key_result_2['key_id']}")
    print(f"  API Key (plaintext - shown only once): {key_result_2['api_key']}")
    print(f"  Created At: {key_result_2['created_at']}\n")
    
    # Show what's stored in the database
    print("=== Database Storage ===")
    print("(Only hashes are stored, never plaintext keys)\n")
    for key_id, key_data in api_keys_db.items():
        print(f"Key ID: {key_id}")
        print(f"  Hash: {key_data['hash']}")
        print(f"  Created: {key_data['created_at']}")
        print(f"  Active: {key_data['active']}\n")
    
    # Verify API keys
    print("=== API Key Verification ===\n")
    
    # Verify valid key
    verification_1 = verify_api_key(key_result_1['api_key'])
    print(f"Verifying Key 1: {verification_1}")
    
    # Verify with wrong key
    wrong_key = secrets.token_bytes(32).hex()
    verification_wrong = verify_api_key(wrong_key)
    print(f"Verifying Wrong Key: {verification_wrong}")
    
    # Verify second key
    verification_2 = verify_api_key(key_result_2['api_key'])
    print(f"Verifying Key 2: {verification_2}\n")
    
    # Demonstrate revocation
    print("=== Key Revocation Demo ===\n")
    api_keys_db[key_result_1['key_id']]['active'] = False
    verification_revoked = verify_api_key(key_result_1['api_key'])
    print(f"Verifying Revoked Key 1: {verification_revoked}")
    print("(Valid key rejected because it was revoked)\n")
    
    print("=== Security Features ===")
    print("✓ Uses secrets.token_bytes(32) for cryptographic randomness")
    print("✓ Encodes as hex string for safe transmission")
    print("✓ Stores only SHA-256 hash, never plaintext")
    print("✓ Plaintext key returned only once during generation")
    print("✓ Supports key revocation")
    print("✓ Verification by comparing hashes")