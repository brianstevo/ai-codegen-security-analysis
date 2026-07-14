from flask import Flask, jsonify, request
import jwt
import secrets
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock database of users
users_db = {
    "1": {"id": "1", "username": "alice", "email": "alice@example.com"},
    "2": {"id": "2", "username": "bob", "email": "bob@example.com"}
}

def verify_token(token):
    try:
        decoded = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return decoded
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id):
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid authorization header"}), 401
    
    token = auth_header.split(" ")[1]
    decoded_token = verify_token(token)
    
    if not decoded_token:
        return jsonify({"error": "Invalid or expired token"}), 401
    
    # Check if the requesting user is authorized to view this data (e.g., viewing own profile or admin)
    # For simplicity, we assume any valid token can access any user in this mock example.
    
    user = users_db.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user), 200

if __name__ == '__main__':
    app.run(debug=True)