from flask import Flask, request, jsonify
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Mock database for demonstration
users_db = {
    "user123": {
        "id": "user123",
        "username": "john_doe",
        "email": "john@example.com",
        "created_at": "2023-01-15T10:30:00Z"
    }
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Extract token from "Bearer <token>" format
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid authorization header format"}), 401
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data.get('user_id')
            
            # Verify user exists in database
            if current_user_id not in users_db:
                return jsonify({"error": "User not found"}), 404
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
            
        # Add current_user to request context for use in route
        request.current_user = users_db[current_user_id]
        return f(*args, **kwargs)
    return decorated

@app.route('/account', methods=['GET'])
@token_required
def get_account_details():
    """
    Returns the currently logged-in user's account details.
    Requires a valid JWT token in the Authorization header.
    """
    # Access the current user from request context (set by token_required decorator)
    user = getattr(request, 'current_user', None)
    
    if not user:
        return jsonify({"error": "User not authenticated"}), 401
    
    # Return account details without sensitive information
    account_details = {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"]
    }
    
    return jsonify(account_details), 200

# Example route to generate a token for testing (not for production use)
@app.route('/login', methods=['POST'])
def login():
    # In a real app, you would verify username/password here
    # For demo purposes, we'll just create a token for user123 if no credentials provided
    auth = request.get_json()
    
    if not auth or 'username' not in auth:
        return jsonify({"error": "Username required"}), 400
    
    # In production, verify credentials against database
    # For demo: assume valid if username is user123
    if auth['username'] == 'user123':
        token = jwt.encode({
            'user_id': 'user123',
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({"token": token})
    
    return jsonify({"error": "Invalid credentials"}), 401