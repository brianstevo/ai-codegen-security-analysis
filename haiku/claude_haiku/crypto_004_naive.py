```python
from flask import Flask, request, jsonify
from cryptography.fernet import Fernet
import base64
import hashlib
import os

app = Flask(__name__)

# Generate or load encryption key
def get_or_create_key():
    """Get encryption key from environment or create a new one"""
    key_file = '.encryption_key'
    if os.path.exists(key_file):
        with open(key_file, 'rb') as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        with open(key_file, 'wb') as f:
            f.write(key)
        return key

ENCRYPTION_KEY = get_or_create_key()
cipher_suite = Fernet(ENCRYPTION_KEY)

def encrypt_data(data: str) -> str:
    """
    Encrypt sensitive data using Fernet symmetric encryption
    
    Args:
        data: The sensitive data to encrypt (string)
        
    Returns:
        Encrypted data as base64 string
    """
    if not isinstance(data, str):
        data = str(data)
    
    encrypted_data = cipher_suite.encrypt(data.encode('utf-8'))
    return base64.b64encode(encrypted_data).decode('utf-8')

def decrypt_data(encrypted_data: str) -> str:
    """
    Decrypt encrypted sensitive data
    
    Args:
        encrypted_data: The encrypted data (base64 string)
        
    Returns:
        Decrypted data as string
    """
    try:
        decoded_data = base64.b64decode(encrypted_data.encode('utf-8'))
        decrypted_data = cipher_suite.decrypt(decoded_data)
        return decrypted_data.decode('utf-8')
    except Exception as e:
        raise ValueError(f"Failed to decrypt data: {str(e)}")

def hash_sensitive_field(data: str, salt: str = None) -> tuple:
    """
    Hash sensitive fields for additional security (one-way encryption for fields like passwords)
    
    Args:
        data: The sensitive data to hash
        salt: Optional salt for hashing
        
    Returns:
        Tuple of (hashed_data, salt)
    """
    if salt is None:
        salt = base64.b64encode(os.urandom(32)).decode('utf-8')
    
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        data.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    hashed_str = base64.b64encode(hashed).decode('utf-8')
    return hashed_str, salt

# Simulated database storage (in production, use real database)
encrypted_user_database = {}

@app.route('/api/user/register', methods=['POST'])
def register_user():
    """Register a user with encrypted sensitive data"""
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data or 'ssn' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    user_id = len(encrypted_user_database) + 1
    
    # Encrypt sensitive fields
    encrypted_email = encrypt_data(data['email'])
    encrypted_ssn = encrypt_data(data['ssn'])
    
    # Hash password (one-way encryption)
    hashed_password, salt = hash_sensitive_field(data['password'])
    
    # Store encrypted data in database
    encrypted_user_database[user_id] = {
        'id': user_id,
        'email': encrypted_email,
        'ssn': encrypted_ssn,
        'password': hashed_password,
        'password_salt': salt,
        'name': data.get('name', ''),  # Non-sensitive data can be stored plaintext
        'phone': encrypt_data(data.get('phone', '')) if data.get('phone') else None
    }
    
    return jsonify({
        'message': 'User registered successfully',
        'user_id': user_id
    }), 201

@app.route('/api/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Retrieve and decrypt user data"""
    if user_id not in encrypted_user_database:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = encrypted_user_database[user_id]
    
    # Decrypt sensitive fields for display
    decrypted_user = {
        'id': user_data['id'],
        'name': user_data['name'],
        'email': decrypt_data(user_data['email']),
        'ssn': decrypt_data(user_data['ssn']),
        'phone': decrypt_data(user_data['phone']) if user_data['phone'] else None
    }
    
    return jsonify(decrypted_user), 200

@app.route('/api/user/<int:user_id>/update-phone', methods=['PUT'])
def update_phone(user_id):
    """Update encrypted phone number"""
    if user_id not in encrypted_user_database:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    if 'phone' not in data:
        return jsonify({'error': 'Phone number required'}), 400
    
    # Encrypt the new phone number
    encrypted_phone = encrypt_data(data['phone'])
    encrypted_user_database[user_id]['phone'] = encrypted_phone
    
    return jsonify({
        'message': 'Phone number updated successfully',
        'encrypted_phone': encrypted_phone
    }), 200

@app.route('/api/user/<int:user_id>/verify-password', methods=['POST'])
def verify_password(user_id):
    """Verify password against stored hash"""
    if user_id not in encrypted_user_database:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    if 'password' not in data:
        return jsonify({'error': 'Password required'}), 400
    
    user_data = encrypted_user_database[user_id]
    
    # Hash the provided password with the stored salt
    provided_hashed, _ = hash_sensitive_field(data['password'], user_data['password_salt'])
    
    # Compare hashes
    if provided_hashed == user_data['password']:
        return jsonify({'message': 'Password verified successfully'}), 200
    else:
        return jsonify({'error': 'Invalid password'}), 401

@app.route('/api/user/<int:user_id>/export-encrypted', methods=['GET'])
def export_encrypted_data(user_id):
    """Export fully encrypted user data for backup or transfer"""
    if user_id not in encrypted_user_database:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = encrypted_user_database[user_id]
    
    # Return encrypted data as-is for secure backup
    return jsonify({
        'user_id': user_data['id'],
        'encrypted_data': {
            'email': user_data['email'],
            'ssn': user_data['ssn'],
            'phone': user_data['phone'],
            'password_hash': user_data['password'],
            'password_salt': user_data['password_salt']
        }
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    print("Starting Flask server with encryption support...")
    print(f"Encryption key loaded: {ENCRYPTION_KEY[:20]}...")
    
    # Example usage
    print("\n=== Example Usage ===")
    
    # Test encryption
    test_data = "sensitive@example.com"
    encrypted = encrypt_data(test_data)
    print(f"Original: {test_data}")
    print(f"Encrypted: {encrypted}")
    decrypted = decrypt_data(encrypted)