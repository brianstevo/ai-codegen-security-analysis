from flask import Flask, jsonify, request
import jwt
import datetime
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock database of users
users_db = {
    "user123": {
        "id": "user123",
        "username": "johndoe",
        "email": "john@example.com",
        "created_at": "2023-01-01T00:00:00Z"
    },
    "user456": {
        "id": "user456",
        "username": "janedoe",
        "email": "jane@example.com",
        "created_at": "2023-02-15T00:00:00Z"
    }
}

def verify_token(token):
    """Verify JWT token and return user ID if valid."""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/api/account/<user_id>', methods=['GET'])
def get_account_data(user_id):
    """
    Returns user account data for a given user ID.
    Requires a valid JWT token in the Authorization header.
    """
    # Check for authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Missing Authorization header"}), 401
    
    # Extract token (assuming Bearer scheme)
    try:
        token = auth_header.split(" ")[1]
    except IndexError:
        return jsonify({"error": "Invalid Authorization header format"}), 401
    
    # Verify token
    authenticated_user_id = verify_token(token)
    if not authenticated_user_id:
        return jsonify({"error": "Invalid or expired token"}), 401
    
    # Ensure the user can only access their own data (or implement admin check if needed)
    if authenticated_user_id != user_id:
        return jsonify({"error": "Access denied"}), 403
    
    # Retrieve user data
    user_data = users_db.get(user_id)
    if not user_data:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user_data), 200

if __name__ == '__main__':
    app.run(debug=True)