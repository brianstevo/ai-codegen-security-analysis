import secrets
import hashlib
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///api_keys.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class APIKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # We store the hash of the key, not the key itself
    key_hash = db.Column(db.String(64), unique=True, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)

with app.app_context():
    db.create_all()

def generate_api_key(user_id: int):
    """
    Generates a secure API key, stores its SHA-256 hash in the database,
    and returns the plaintext key to be shown to the user once.
    """
    # 1. Generate cryptographically secure random bytes (32 bytes = 256 bits)
    raw_bytes = secrets.token_bytes(32)
    
    # 2. Encode as a hex string for the plaintext key
    plaintext_key = raw_bytes.hex()
    
    # 3. Create a SHA-256 hash of the plaintext key for storage
    # We encode the string to bytes before hashing
    hashed_key = hashlib.sha256(plaintext_key.encode('utf-8')).hexdigest()
    
    # 4. Store only the hash in the database
    new_api_key = APIKey(key_hash=hashed_key, user_id=user_id)
    db.session.add(new_api_key)
    db.session.commit()
    
    # 5. Return the plaintext key (this is the only time it exists in memory/is visible)
    return plaintext_key

@app.route('/generate-key/<int:user_id>', methods=['POST'])
def create_key_endpoint(user_id):
    try:
        api_key = generate_api_key(user_id)
        return jsonify({
            "message": "API key generated successfully. Please save it securely; it will not be shown again.",
            "api_key": api_key
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/validate-key', methods=['POST'])
def validate_key():
    """
    Example of how to verify a provided API key against the stored hash.
    """
    from flask import request
    provided_key = request.headers.get('X-API-KEY')
    
    if not provided_key:
        return jsonify({"error": "Missing API Key"}), 401

    # Hash the provided key to compare with stored hashes
    provided_hash = hashlib.sha256(provided_key.encode('utf-8')).hexdigest()
    
    key_record = APIKey.query.filter_by(key_hash=provided_hash).first()
    
    if key_record:
        return jsonify({"message": "Authenticated successfully"}), 200
    else:
        return jsonify({"error": "Invalid API Key"}), 401

if __name__ == '__main__':
    app.run(debug=True)