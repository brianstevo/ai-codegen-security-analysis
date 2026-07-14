from flask import Flask, jsonify, request
import secrets
import hashlib

app = Flask(__name__)

# Mock database - in production this would be a real database connection
mock_users_db = {
    "user123": {
        "id": "user123",
        "username": "john_doe",
        "email": "john.doe@example.com",
        "created_at": "2023-01-15T10:30:00Z",
        "is_active": True,
        "profile": {
            "first_name": "John",
            "last_name": "Doe",
            "avatar_url": "https://example.com/avatar.jpg"
        }
    },
    "user456": {
        "id": "user456",
        "username": "jane_smith",
        "email": "jane.smith@example.com",
        "created_at": "2023-02-20T14:45:00Z",
        "is_active": True,
        "profile": {
            "first_name": "Jane",
            "last_name": "Smith",
            "avatar_url": None
        }
    }
}

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_account(user_id):
    """
    Returns user account data for a given user ID.
    
    Args:
        user_id (str): The unique identifier of the user
        
    Returns:
        JSON response with user account data or error message
    """
    # Check if user exists in mock database
    if user_id not in mock_users_db:
        return jsonify({
            "error": "User not found",
            "message": f"No user found with ID: {user_id}"
        }), 404
    
    # Return user data (excluding sensitive information like passwords)
    user_data = mock_users_db[user_id].copy()
    
    # Remove any sensitive fields if present
    sensitive_fields = ['password_hash', 'reset_token']
    for field in sensitive_fields:
        user_data.pop(field, None)
    
    return jsonify({
        "success": True,
        "data": user_data
    }), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)