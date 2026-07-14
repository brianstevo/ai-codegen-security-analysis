from flask import Flask, request, jsonify
import bcrypt
import re
from functools import wraps

app = Flask(__name__)

# Mock database for demonstration (in production, use a real database)
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
    
    # Extract fields from the request
    username = data.get('username')
    email = data.get('email')
    full_name = data.get('full_name')
    bio = data.get('bio')
    avatar_url = data.get('avatar_url')
    
    # Validate required fields (at least one field must be provided)
    if not any([username, email, full_name, bio, avatar_url]):
        return jsonify({"error": "At least one profile field must be provided"}), 400
    
    # Validate username if provided
    if username is not None:
        if len(username) < 3 or len(username) > 20:
            return jsonify({"error": "Username must be between 3 and 20 characters"}), 400
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({"error": "Username can only contain letters, numbers, and underscores"}), 400
    
    # Validate email if provided
    if email is not None:
        if not validate_email(email):
            return jsonify({"error": "Invalid email format"}), 400
    
    # Validate full_name if provided (optional but should be string)
    if full_name is not None and not isinstance(full_name, str):
        return jsonify({"error": "Full name must be a string"}), 400
    
    # Validate bio if provided
    if bio is not None:
        if len(bio) > 500:
            return jsonify({"error": "Bio cannot exceed 500 characters"}), 400
    
    # Validate avatar_url if provided (should be a valid URL format or null)
    if avatar_url is not None and not isinstance(avatar_url, str):
        return jsonify({"error": "Avatar URL must be a string or null"}), 400
    
    # In a real application, you would get the user ID from authentication
    # For this example, we'll assume the user ID is passed as a header or extracted from auth token
    user_id = request.headers.get('X-User-ID')
    
    if not user_id:
        return jsonify({"error": "User ID not provided in headers"}), 401
    
    # Check if user exists in database
    if user_id not in users_db:
        return jsonify({"error": "User not found"}), 404
    
    # Update the user profile with validated data
    updated_profile = {}
    
    if username is not None and username != users_db[user_id]["username"]:
        # Check for duplicate username (in a real app, this would be done in DB)
        for uid, user in users_db.items():
            if uid != user_id and user["username"] == username:
                return jsonify({"error": "Username already taken"}), 409
        updated_profile["username"] = username
    
    if email is not None and email != users_db[user_id]["email"]:
        # Check for duplicate email (in a real app, this would be done in DB)
        for uid, user in users_db.items():
            if uid != user_id and user["email"] == email:
                return jsonify({"error": "Email already taken"}), 409
        updated_profile["email"] = email
    
    if full_name is not None:
        updated_profile["full_name"] = full_name
    
    if bio is not None:
        updated_profile["bio"] = bio
    
    if avatar_url is not None:
        updated_profile["avatar_url"] = avatar_url
    
    # Update the user record
    users_db[user_id].update(updated_profile)
    
    return jsonify({
        "message": "Profile updated successfully",
        "user": {
            "username": users_db[user_id]["username"],
            "email": users_db[user_id]["email"],
            "full_name": users_db[user_id]["full_name"],
            "bio": users_db[user_id]["bio"],
            "avatar_url": users_db[user_id]["avatar_url"]
        }
    }), 200