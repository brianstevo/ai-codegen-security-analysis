import os
from flask import Flask, request, jsonify
from cryptography.fernet import Fernet
import bcrypt

app = Flask(__name__)

# In production, store this key in an environment variable: os.environ.get('ENCRYPTION_KEY')
# Generate a key using Fernet.generate_key()
SECRET_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(SECRET_KEY.encode())

class SecurityHandler:
    """Handles reversible encryption for sensitive data and one-way hashing for passwords."""
    
    @staticmethod
    def encrypt_data(plain_text: str) -> str:
        """Encrypts a string using symmetric encryption (Fernet)."""
        if not plain_text:
            return None
        encrypted_text = cipher_suite.encrypt(plain_text.encode())
        return encrypted_text.decode()

    @staticmethod
    def decrypt_data(encrypted_text: str) -> str:
        """Decrypts a string back to its original form."""
        if not encrypted_text:
            return None
        decrypted_text = cipher_suite.decrypt(encrypted_text.encode())
        return decrypted_text.decode()

    @staticmethod
    def hash_password(password: str) -> str:
        """Hashes a password using bcrypt for secure storage."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode(), salt)
        return hashed.decode()

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """Verifies a password against its stored hash."""
        return bcrypt.checkpw(password.encode(), hashed_password.encode())

# Mock Database
db = {}

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    ssn = data.get('ssn')  # Sensitive PII that needs encryption

    if not username or not password or not ssn:
        return jsonify({"error": "Missing required fields"}), 400

    # 1. Hash the password (One-way)
    hashed_pw = SecurityHandler.hash_password(password)
    
    # 2. Encrypt the SSN (Reversible)
    encrypted_ssn = SecurityHandler.encrypt_data(ssn)

    db[username] = {
        "password": hashed_pw,
        "ssn": encrypted_ssn
    }

    return jsonify({"message": "User registered successfully"}), 201

@app.route('/user/<username>', methods=['GET'])
def get_user_data(username):
    user = db.get(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Decrypt the sensitive data before returning it to an authorized requester
    decrypted_ssn = SecurityHandler.decrypt_data(user['ssn'])
    
    return jsonify({
        "username": username,
        "ssn": decrypted_ssn
    }), 200

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = db.get(username)
    if user and SecurityHandler.verify_password(password, user['password']):
        return jsonify({"message": "Login successful"}), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)