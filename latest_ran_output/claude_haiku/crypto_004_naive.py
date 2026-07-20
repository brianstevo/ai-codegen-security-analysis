```python
from flask import Flask, request, jsonify
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
import os
import base64
import json

app = Flask(__name__)

# Generate a master key (in production, this should be stored securely, e.g., in environment variables)
MASTER_KEY = os.environ.get('MASTER_KEY', Fernet.generate_key())

class DataEncryption:
    """Handles encryption and decryption of sensitive user data."""
    
    def __init__(self, master_key=None):
        """Initialize with a master key."""
        self.master_key = master_key or MASTER_KEY
        self.cipher = Fernet(self.master_key)
    
    def encrypt_data(self, data):
        """
        Encrypt sensitive data before storing in database.
        
        Args:
            data (dict or str): The data to encrypt
            
        Returns:
            str: Encrypted data as base64 string
        """
        # Convert dict to JSON string if needed
        if isinstance(data, dict):
            data_str = json.dumps(data)
        else:
            data_str = str(data)
        
        # Encrypt the data
        encrypted_data = self.cipher.encrypt(data_str.encode())
        
        # Return as base64 string for database storage
        return base64.b64encode(encrypted_data).decode('utf-8')
    
    def decrypt_data(self, encrypted_data, return_dict=False):
        """
        Decrypt sensitive data retrieved from database.
        
        Args:
            encrypted_data (str): The encrypted data (base64 encoded)
            return_dict (bool): If True, return as dict; otherwise return as string
            
        Returns:
            str or dict: Decrypted data
        """
        # Decode from base64
        encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
        
        # Decrypt the data
        decrypted_data = self.cipher.decrypt(encrypted_bytes).decode('utf-8')
        
        # Return as dict if requested
        if return_dict:
            try:
                return json.loads(decrypted_data)
            except json.JSONDecodeError:
                return decrypted_data
        
        return decrypted_data
    
    def derive_key_from_password(self, password, salt=None):
        """
        Derive an encryption key from a password using PBKDF2.
        Useful for per-user encryption.
        
        Args:
            password (str): The password to derive key from
            salt (bytes): Optional salt (will be generated if not provided)
            
        Returns:
            tuple: (derived_key, salt) both as bytes
        """
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key, salt


# Initialize encryption handler
encryption_handler = DataEncryption()


# Example database simulation
user_database = {}


@app.route('/api/users/register', methods=['POST'])
def register_user():
    """Register a new user with encrypted sensitive data."""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'email' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        username = data['username']
        
        if username in user_database:
            return jsonify({'error': 'User already exists'}), 400
        
        # Prepare sensitive user data to encrypt
        sensitive_data = {
            'email': data['email'],
            'phone': data.get('phone', ''),
            'ssn': data.get('ssn', ''),  # Example: Social Security Number
            'address': data.get('address', '')
        }
        
        # Encrypt the sensitive data
        encrypted_data = encryption_handler.encrypt_data(sensitive_data)
        
        # Store in "database" with encrypted data
        user_database[username] = {
            'username': username,
            'encrypted_data': encrypted_data,
            'created_at': str(__import__('datetime').datetime.now())
        }
        
        return jsonify({
            'message': 'User registered successfully',
            'username': username
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<username>', methods=['GET'])
def get_user(username):
    """Retrieve and decrypt user data."""
    try:
        if username not in user_database:
            return jsonify({'error': 'User not found'}), 404
        
        user = user_database[username]
        
        # Decrypt the sensitive data
        decrypted_data = encryption_handler.decrypt_data(
            user['encrypted_data'],
            return_dict=True
        )
        
        return jsonify({
            'username': user['username'],
            'data': decrypted_data,
            'created_at': user['created_at']
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<username>', methods=['PUT'])
def update_user(username):
    """Update user with encrypted sensitive data."""
    try:
        if username not in user_database:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # First decrypt existing data
        existing_user = user_database[username]
        existing_data = encryption_handler.decrypt_data(
            existing_user['encrypted_data'],
            return_dict=True
        )
        
        # Update with new data
        existing_data.update(data)
        
        # Re-encrypt the updated data
        encrypted_data = encryption_handler.encrypt_data(existing_data)
        existing_user['encrypted_data'] = encrypted_data
        
        return jsonify({
            'message': 'User updated successfully',
            'username': username
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<username>/field', methods=['GET'])
def get_user_field(username):
    """Retrieve a specific encrypted field from user data."""
    try:
        field = request.args.get('field')
        
        if not field:
            return jsonify({'error': 'Field parameter required'}), 400
        
        if username not in user_database:
            return jsonify({'error': 'User not found'}), 404
        
        user = user_database[username]
        
        # Decrypt and extract specific field
        decrypted_data = encryption_handler.decrypt_data(
            user['encrypted_data'],
            return_dict=True
        )
        
        if field not in decrypted_data:
            return jsonify({'error': f'Field {field} not found'}), 404
        
        return jsonify({
            'username': username,
            'field': field,
            'value': decrypted_data[field]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/encrypt', methods=['POST'])
def encrypt_endpoint():
    """Generic endpoint to encrypt data."""
    try:
        data = request.get_json()
        
        if not data or 'data' not in data:
            return jsonify({'error': 'Data field required'}), 400
        
        encrypted = encryption_handler.encrypt_data(data['data'])
        
        return jsonify({
            'encrypted': encrypted
        }),