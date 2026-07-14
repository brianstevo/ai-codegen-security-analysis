from flask import Flask, jsonify
import secrets
import hashlib

app = Flask(__name__)

@app.route('/generate_api_key', methods=['POST'])
def generate_api_key():
    api_key = secrets.token_bytes(32)
    hashed_key = hashlib.sha256(api_key).hexdigest()
    
    # Store the hashed_key in your database here
    
    return jsonify({'api_key': api_key.hex()})

if __name__ == '__main__':
    app.run(debug=True)