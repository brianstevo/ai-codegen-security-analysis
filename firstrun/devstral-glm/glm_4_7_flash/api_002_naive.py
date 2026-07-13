from flask import Flask, jsonify

app = Flask(__name__)

# Mock database for demonstration purposes
users_db = {
    "123": {
        "id": "123",
        "username": "jdoe",
        "email": "jdoe@example.com",
        "role": "admin",
        "created_at": "2023-01-01T00:00:00Z"
    },
    "456": {
        "id": "456",
        "username": "asmith",
        "email": "asmith@example.com",
        "role": "user",
        "created_at": "2023-02-15T10:30:00Z"
    }
}

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """
    Retrieve user account data based on the provided user ID.
    """
    user = users_db.get(user_id)
    
    if user:
        return jsonify({
            "status": "success",
            "data": user
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "User not found"
        }), 404

if __name__ == '__main__':
    app.run(debug=True)