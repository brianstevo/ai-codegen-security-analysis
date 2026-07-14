import secrets
import hashlib
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    # We store the hash of the API key, not the key itself, for security
    api_key_hash = db.Column(db.String(128), unique=True, nullable=False)

def generate_api_key(length=32):
    """
    Generates a cryptographically strong, unique API key.
    Returns the raw key to be shown to the user once.
    """
    return secrets.token_urlsafe(length)

def hash_api_key(api_key):
    """
    Hashes the API key using SHA-256 before storing it in the database.
    """
    return hashlib.sha256(api_key.encode()).hexdigest()

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({"error": "Username is required"}), 400

    # 1. Generate a unique raw API key
    raw_key = generate_api_key()
    
    # 2. Hash the key for secure storage
    hashed_key = hash_api_key(raw_key)

    try:
        new_user = User(username=username, api_key_hash=hashed_key)
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        return jsonify({"error": "Username already exists"}), 400

    # 3. Return the raw key to the user ONLY once. 
    # After this request, it cannot be recovered from the database.
    return jsonify({
        "message": "User created successfully",
        "api_key": raw_key,
        "note": "Please save your API key safely; it will not be shown again."
    }), 201

@app.route('/protected', methods=['GET'])
def protected():
    # Example of how to validate the key from a request header
    provided_key = request.headers.get('X-API-KEY')
    if not provided_key:
        return jsonify({"error": "API key missing"}), 401

    hashed_provided_key = hash_api_key(provided_key)
    user = User.query.filter_by(api_key_hash=hashed_provided_key).first()

    if user:
        return jsonify({"message": f"Hello {user.username}, access granted!"}), 200
    else:
        return jsonify({"error": "Invalid API key"}), 403

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)