import secrets
import hashlib
from flask import Flask, jsonify
from datetime import datetime

app = Flask(__name__)

def generate_api_key():
    """
    Generate a unique API key for a new user.
    Returns a dictionary with the raw key and hashed key.
    The raw key should be shown to the user once, the hashed key stored in database.
    """
    # Generate a cryptographically secure random token
    raw_key = secrets.token_urlsafe(32)
    
    # Hash the key for storage (you'd typically store this in the database)
    hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()
    
    return {
        'raw_key': raw_key,  # Show this to user only once
        'hashed_key': hashed_key,  # Store this in database
        'created_at': datetime.utcnow().isoformat()
    }

def verify_api_key(provided_key, stored_hashed_key):
    """
    Verify that a provided API key matches the stored hashed key.
    """
    provided_hash = hashlib.sha256(provided_key.encode()).hexdigest()
    return provided_hash == stored_hashed_key

@app.route('/api/generate-key', methods=['POST'])
def api_generate_key():
    """
    API endpoint to generate a new API key for a user.
    In a real application, you would:
    1. Authenticate the user
    2. Store the hashed_key in the database
    3. Return only the raw_key to the user
    """
    key_data = generate_api_key()
    
    # In production, you would save key_data['hashed_key'] to your database
    # associated with the user
    
    return jsonify({
        'success': True,
        'api_key': key_data['raw_key'],
        'message': 'Save this API key securely. You will not be able to see it again.',
        'created_at': key_data['created_at']
    }), 201

@app.route('/api/verify-key', methods=['POST'])
def api_verify_key():
    """
    Endpoint to verify an API key (for demonstration).
    In production, this would check the key against your database.
    """
    from flask import request
    
    data = request.get_json()
    provided_key = data.get('api_key')
    stored_hash = data.get('stored_hash')  # This would come from your database
    
    if not provided_key or not stored_hash:
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    is_valid = verify_api_key(provided_key, stored_hash)
    
    return jsonify({
        'success': True,
        'is_valid': is_valid
    }), 200

if __name__ == '__main__':
    # Demonstration of the API key generation
    print("Generating a new API key...")
    key_info = generate_api_key()
    print(f"Raw API Key (show to user): {key_info['raw_key']}")
    print(f"Hashed Key (store in database): {key_info['hashed_key']}")
    print(f"Created at: {key_info['created_at']}")
    
    # Demonstration of verification
    print("\nVerifying the API key...")
    is_valid = verify_api_key(key_info['raw_key'], key_info['hashed_key'])
    print(f"Is valid: {is_valid}")
    
    # Test with wrong key
    print("\nTesting with wrong key...")
    is_valid_wrong = verify_api_key("wrong_key_here", key_info['hashed_key'])
    print(f"Is valid (wrong key): {is_valid_wrong}")
    
    # Uncomment to run the Flask app
    # app.run(debug=True)