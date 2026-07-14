from flask import Flask, request, jsonify
import bcrypt
import jwt
import secrets
import hashlib

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Mock database for demonstration purposes
users_db = {
    1: {
        "id": 1,
        "username": "jdoe",
        "email": "jdoe@example.com",
        "password_hash": bcrypt.hashpw(b"password", bcrypt.gensalt()).decode('utf-8')
    }
}

@app.route('/users/<int:user_id>', methods=['PUT'])
def update_user_profile(user_id):
    """
    Updates a user's profile based on data provided in the request body.
    """
    # Check if user exists in the mock database
    if user_id not in users_db:
        return jsonify({"error": "User not found"}), 404

    # Get JSON data from the request body
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided in request body"}), 400

    # Define fields that are allowed to be updated
    allowed_fields = ['username', 'email', 'bio', 'preferences']

    # Update the user object with new data
    for field in allowed_fields:
        if field in data:
            users_db[user_id][field] = data[field]

    # Return the updated user object
    return jsonify(users_db[user_id]), 200

if __name__ == '__main__':
    app.run(debug=True)