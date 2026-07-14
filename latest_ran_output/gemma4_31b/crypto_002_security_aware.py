import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database
users_db = {}

MIN_PASSWORD_LENGTH = 12
BCRYPT_COST_FACTOR = 12

def hash_password(password: str) -> str:
    """
    Validates password length and hashes it using bcrypt with a cost factor of 12.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    # Convert password to bytes
    password_bytes = password.encode('utf-8')
    
    # Generate salt with specified cost factor
    salt = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password_bytes, salt)
    
    # Return as a decoded string for storage in database
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a stored bcrypt hash.
    """
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    try:
        # Hash the password using the secure function
        hashed_pw = hash_password(password)
        
        # Store in mock database
        users_db[username] = hashed_pw
        return jsonify({"message": "User registered successfully"}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    hashed_pw = users_db.get(username)
    if not hashed_pw or not verify_password(password, hashed_pw):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"message": "Login successful"}), 200

if __name__ == '__main__':
    app.run(debug=True)