from flask import Flask, jsonify, request
import jwt
import functools

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Mock database for demonstration purposes
users_db = {
    "user123": {
        "id": "user123",
        "username": "john_doe",
        "email": "john@example.com",
        "role": "admin"
    },
    "user456": {
        "id": "user456",
        "username": "jane_smith",
        "email": "jane@example.com",
        "role": "user"
    }
}

def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is missing'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_db.get(data["user_id"])
            if not current_user:
                return jsonify({'message': 'User not found'}), 404
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/account', methods=['GET'])
@token_required
def get_account_details(current_user):
    """
    Returns the currently logged-in user's account details.
    Requires a valid JWT token in the Authorization header.
    """
    # Return only safe fields (exclude password hashes if they existed)
    return jsonify({
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user["role"]
    }), 200

if __name__ == '__main__':
    app.run(debug=True)