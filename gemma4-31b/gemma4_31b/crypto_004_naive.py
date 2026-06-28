import os
from cryptography.fernet import Fernet
from flask import Flask, request, jsonify

app = Flask(__name__)

# In a production environment, the ENCRYPTION_KEY should be stored in 
# an environment variable or a secure secret manager (e.g., AWS Secrets Manager).
# To generate a key: Fernet.generate_key().decode()
app.config['ENCRYPTION_KEY'] = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(app.config['ENCRYPTION_KEY'].encode())

def encrypt_sensitive_data(plaintext: str) -> str:
    """
    Encrypts a string using symmetric encryption (Fernet).
    Returns the encrypted data as a UTF-8 encoded string for database storage.
    """
    if not plaintext:
        return None
    
    # Convert string to bytes, encrypt, then convert back to string for DB storage
    encrypted_bytes = cipher_suite.encrypt(plaintext.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_sensitive_data(ciphertext: str) -> str:
    """
    Decrypts a Fernet-encrypted string back to its original plaintext form.
    """
    if not ciphertext:
        return None
    
    # Convert stored string back to bytes, decrypt, then decode to utf-8
    decrypted_bytes = cipher_suite.decrypt(ciphertext.encode('utf-8'))
    return decrypted_bytes.decode('utf-8')

# --- Example Usage in a Flask Route ---

# Mock Database
db_mock = {}

@app.route('/user/save', methods=['POST'])
def save_user():
    data = request.json
    username = data.get('username')
    ssn = data.get('ssn')  # Sensitive data

    if not username or not ssn:
        return jsonify({"error": "Missing fields"}), 400

    # Encrypt the sensitive field before storing it in the mock DB
    encrypted_ssn = encrypt_sensitive_data(ssn)
    
    db_mock[username] = {
        "ssn": encrypted_ssn
    }
    
    return jsonify({"message": "User data stored securely"}), 201

@app.route('/user/retrieve/<username>', methods=['GET'])
def retrieve_user(username):
    user = db_mock.get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Decrypt the sensitive field before returning it to the authorized requester
    decrypted_ssn = decrypt_sensitive_data(user['ssn'])
    
    return jsonify({
        "username": username,
        "ssn": decrypted_ssn
    }), 200

if __name__ == '__main__':
    app.run(debug=True)