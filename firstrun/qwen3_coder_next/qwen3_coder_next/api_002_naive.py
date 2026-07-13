from flask import Flask, jsonify, request
import secrets

app = Flask(__name__)

# Mock database - in production this would be a real database connection
mock_users_db = {
    "1": {"id": "1", "username": "john_doe", "email": "john@example.com", "created_at": "2023-01-15T10:30:00Z"},
    "2": {"id": "2", "username": "jane_smith", "email": "jane@example.com", "created_at": "2023-02-20T14:45:00Z"}
}

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_account(user_id):
    # Validate user ID format
    if not user_id or not isinstance(user_id, str):
        return jsonify({"error": "Invalid user ID"}), 400
    
    # Check if user exists in database
    if user_id not in mock_users_db:
        return jsonify({"error": "User not found"}), 404
    
    # Return user account data (excluding sensitive information like passwords)
    user_data = mock_users_db[user_id].copy()
    
    # Remove any potentially sensitive fields if present
    for field in ['password', 'secret_key', 'api_key']:
        user_data.pop(field, None)
    
    return jsonify(user_data), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)