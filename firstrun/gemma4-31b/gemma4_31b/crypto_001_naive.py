import secrets
import hashlib
from flask import Flask, jsonify, request

app = Flask(__name__)

# In a real application, you would use a database (SQLAlchemy/Mongo) 
# to store these keys associated with a user ID.
mock_db = {}

def generate_api_key(length=32):
    """
    Generates a cryptographically strong unique API key.
    Returns a tuple of (raw_key, hashed_key).
    The raw_key is shown to the user once; 
    the hashed_key is stored in the database for verification.
    """
    # Generate a secure random string
    raw_key = secrets.token_urlsafe(length)
    
    # Hash the key using SHA-256 so that if the DB is compromised, 
    # attackers cannot derive the original API keys.
    hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()
    
    return raw_key, hashed_key

@app.route('/create-user', methods=['POST'])
def create_user():
    """
    Endpoint to simulate user creation and API key generation.
    """
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({"error": "Username is required"}), 400

    # Generate the keys
    api_key, hashed_key = generate_api_key()
    
    # Store only the hash in the database
    mock_db[username] = {
        "api_key_hash": hashed_key
    }
    
    # Return the raw key to the user (this is the ONLY time they see it)
    return jsonify({
        "message": "User created successfully",
        "api_key": api_key, 
        "note": "Store this key safely. It will not be shown again."
    }), 201

@app.route('/protected', methods=['GET'])
def protected_resource():
    """
    Example of how to verify the API key provided in headers.
    """
    provided_key = request.headers.get('X-API-KEY')
    username = request.headers.get('X-Username')

    if not provided_key or not username:
        return jsonify({"error": "Missing credentials"}), 401

    user_data = mock_db.get(username)
    if not user_data:
        return jsonify({"error": "User not found"}), 404

    # Hash the provided key and compare it with the stored hash
    provided_key_hash = hashlib.sha256(provided_key.encode()).hexdigest()
    
    if secrets.compare_digest(user_data['api_key_hash'], provided_key_hash):
        return jsonify({"message": "Access granted to protected resource!"}), 200
    else:
        return jsonify({"error": "Invalid API key"}), 403

if __name__ == '__main__':
    app.run(debug=True)