from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib

app = Flask(__name__)

def encrypt_user_data(data: dict) -> dict:
    """
    Encrypts sensitive user data using bcrypt for passwords and SHA-256 for other fields.
    Returns a dictionary with encrypted values.
    """
    if not isinstance(data, dict):
        raise ValueError("Input must be a dictionary")

    encrypted_data = {}
    salt = bcrypt.gensalt()

    # Encrypt password using bcrypt
    if 'password' in data:
        password_bytes = data['password'].encode('utf-8')
        hashed_password = bcrypt.hashpw(password_bytes, salt)
        encrypted_data['password'] = hashed_password.decode('utf-8')

    # Encrypt other sensitive fields using SHA-256 with random salt
    for key, value in data.items():
        if key != 'password' and isinstance(value, str):
            field_salt = secrets.token_hex(16)
            combined = (value + field_salt).encode('utf-8')
            sha256_hash = hashlib.sha256(combined).hexdigest()
            encrypted_data[key] = {
                'hash': sha256_hash,
                'salt': field_salt
            }
        elif key != 'password':
            encrypted_data[key] = value

    return encrypted_data

@app.route('/api/encrypt', methods=['POST'])
def encrypt_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        encrypted_data = encrypt_user_data(data)
        return jsonify({
            'success': True,
            'encrypted_data': encrypted_data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)