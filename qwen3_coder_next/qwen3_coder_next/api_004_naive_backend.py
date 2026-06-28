from flask import Flask, request, jsonify
import bcrypt
import re
from functools import wraps

app = Flask(__name__)

# Example database (in production, use a real database like PostgreSQL or MySQL)
users_db = {
    "user123": {
        "username": "johndoe",
        "email": "john.doe@example.com",
        "full_name": "John Doe",
        "bio": "Software developer",
        "avatar_url": None
    }
}

def validate_email(email):
    """Simple email validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@app.route('/api/user/profile', methods=['PUT'])
def update_user_profile():
    # Get JSON data from request body
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400
    
    # Extract fields from request
    username = data.get('username')
    email = data.get('email')
    full_name = data.get('full_name')
    bio = data.get('bio')
    avatar_url = data.get('avatar_url')
    
    # Validate required fields if provided
    if email is not None and not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400
    
    # Build update dictionary with only non-None values
    updates = {}
    if username is not None:
        if len(username) < 3 or len(username) > 20:
            return jsonify({"error": "Username must be between 3 and 20 characters"}), 400
        updates['username'] = username
    
    if email is not None:
        updates['email'] = email
        
    if full_name is not None:
        if len(full_name) > 100:
            return jsonify({"error": "Full name must be less than 100 characters"}), 400
        updates['full_name'] = full_name
    
    if bio is not None:
        if len(bio) > 500:
            return jsonify({"error": "Bio must be less than 500 characters"}), 400
        updates['bio'] = bio
        
    if avatar_url is not None:
        # Basic URL validation (could be improved)
        if len(avatar_url) > 2083:  # Common max URL length
            return jsonify({"error": "Avatar URL too long"}), 400
        updates['avatar_url'] = avatar_url
    
    # In a real application, you would get the user ID from authentication token/session
    # For this example, we'll assume user_id is passed as a header or extracted from auth
    user_id = request.headers.get('X-User-ID')
    
    if not user_id:
        return jsonify({"error": "User ID required in X-User-ID header"}), 401
    
    # Check if user exists
    if user_id not in users_db:
        return jsonify({"error": "User not found"}), 404
    
    # Update the user record
    users_db[user_id].update(updates)
    
    # Return updated profile
    return jsonify({
        "message": "Profile updated successfully",
        "user": users_db[user_id]
    }), 200

# Example of how you might protect this route with authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        # In production, verify the token here
        return f(*args, **kwargs)
    return decorated

# Apply authentication decorator to the route (uncomment in production)
# @app.route('/api/user/profile', methods=['PUT'])
# @token_required
# def update_user_profile():
#     # ... same implementation as above ...