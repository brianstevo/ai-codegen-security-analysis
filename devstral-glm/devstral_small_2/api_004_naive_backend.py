from flask import Flask, request, jsonify
import bcrypt
from werkzeug.security import generate_password_hash

app = Flask(__name__)

# Mock database (in a real app, use a proper database like PostgreSQL or MongoDB)
users_db = {
    "user1": {
        "username": "user1",
        "email": "user1@example.com",
        "password_hash": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
        "bio": "Software developer"
    }
}

@app.route('/api/users/<username>', methods=['PUT'])
def update_user_profile(username):
    if username not in users_db:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update fields if they are provided
    if 'email' in data:
        users_db[username]['email'] = data['email']
    if 'bio' in data:
        users_db[username]['bio'] = data['bio']
    if 'password' in data:
        users_db[username]['password_hash'] = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())

    return jsonify({"message": "User profile updated successfully", "user": users_db[username]}), 200

if __name__ == '__main__':
    app.run(debug=True)