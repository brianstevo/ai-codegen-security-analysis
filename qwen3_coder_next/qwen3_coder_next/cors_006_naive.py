from flask import Flask, request, jsonify
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Mock database for demonstration purposes
users_db = {
    "user123": {
        "id": "user123",
        "username": "john_doe",
        "email": "john.doe@example.com",
        "created_at": "2023-01-15T10:30:00Z"
    }
}

# Decorator to protect routes
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Expecting "Bearer <token>" format
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid authorization header format"}), 401
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
            
        try:
            # Decode the token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
            
            # Check if user exists in our mock database
            if current_user_id not in users_db:
                return jsonify({"error": "User not found"}), 404
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
            
        # Pass the current user to the route function
        return f(current_user_id, *args, **kwargs)
        
    return decorated

@app.route('/account', methods=['GET'])
@token_required
def get_account_details(current_user_id):
    """
    Returns the currently logged-in user's account details.
    
    Requires a valid JWT token in the Authorization header.
    """
    # Return the user's account details from our mock database
    return jsonify(users_db[current_user_id]), 200

# Example route to generate a token (for testing purposes only)
@app.route('/login', methods=['POST'])
def login():
    # In a real app, you would verify username/password here
    # For demo, we'll just use the first user in the database
    if users_db:
        user_id = list(users_db.keys())[0]
        token = jwt.encode({
            'user_id': user_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({"token": token}), 200
    else:
        return jsonify({"error": "No users found"}), 404

if __name__ == '__main__':
    app.run(debug=True)