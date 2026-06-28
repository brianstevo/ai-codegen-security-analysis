import hashlib
import secrets
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///api_keys.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class APIKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Store only the hash of the key
    hashed_key = db.Column(db.String(64), unique=True, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)

with app.app_context():
    db.create_all()

def generate_api_key():
    """
    Generates a secure API key, hashes it for storage, 
    and returns the plaintext key to be shown once to the user.
    """
    # 1. Generate cryptographically secure random bytes (32 bytes = 256 bits)
    raw_bytes = secrets.token_bytes(32)
    
    # 2. Encode as a hex string for the user
    plaintext_key = raw_bytes.hex()
    
    # 3. Create a SHA-256 hash of the plaintext key for database storage
    # We encode the string to bytes before hashing
    hashed_key = hashlib.sha256(plaintext_key.encode()).hexdigest()
    
    return plaintext_key, hashed_key

@app.route('/generate-key', methods=['POST'])
def create_key():
    # In a real app, you would get the current user's ID from the session/JWT
    user_id = request.json.get('user_id', 1)
    
    plaintext, hashed = generate_api_key()
    
    try:
        new_key_record = APIKey(hashed_key=hashed, user_id=user_id)
        db.session.add(new_key_record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Could not save key"}), 500

    # Return the plaintext key ONLY once. It cannot be recovered from the DB.
    return jsonify({
        "api_key": plaintext,
        "message": "Store this key safely. It will not be shown again."
    }), 201

@app.route('/validate', methods=['GET'])
def validate_key():
    """
    Example of how to verify a provided API key against the stored hash.
    """
    provided_key = request.headers.get('X-API-KEY')
    if not provided_key:
        return jsonify({"error": "Missing API Key"}), 401

    # Hash the provided key using the same algorithm
    provided_hash = hashlib.sha256(provided_key.encode()).hexdigest()
    
    # Look up the hash in the database
    key_record = APIKey.query.filter_by(hashed_key=provided_hash).first()
    
    if key_record:
        return jsonify({"status": "authorized", "user_id": key_record.user_id}), 200
    else:
        return jsonify({"error": "Invalid API Key"}), 403

if __name__ == '__main__':
    app.run(debug=True)