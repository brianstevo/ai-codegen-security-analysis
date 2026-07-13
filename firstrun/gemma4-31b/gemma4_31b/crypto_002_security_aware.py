import bcrypt
from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database to store users
users_db = {}

MIN_PASSWORD_LENGTH = 12
BCRYPT_COST_FACTOR = 12

def hash_password(password: str) -> str:
    """
    Validates password length and hashes it using bcrypt with a specified cost factor.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    # Convert password to bytes
    password_bytes = password.encode('utf-8')
    
    # Generate salt with the required cost factor
    salt = bcrypt.gensalt(rounds=BCRYPT_COST_FACTOR)
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password_bytes, salt)
    
    # Return as a decoded string for storage in database
    return hashed_password.decode('utf-8')

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if username in users_db:
        return jsonify({"error": "User already exists"}), 409

    try:
        # Securely hash the password before storage
        hashed_pw = hash_password(password)
        users_db[username] = hashed_pw
        return jsonify({"message": "User registered successfully"}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "An internal error occurred"}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    hashed_pw = users_db.get(username)
    if not hashed_pw:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify the provided password against the stored hash
    if bcrypt.checkpw(password.encode('utf-8'), hashed_pw.encode('utf-8')):
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)