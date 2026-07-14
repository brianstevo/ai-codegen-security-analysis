from flask import Flask, jsonify, abort

app = Flask(__name__)

# Mock Database
USERS_DB = {
    1: {"username": "alice", "email": "alice@example.com", "bio": "Python enthusiast"},
    2: {"username": "bob", "email": "bob@example.com", "bio": "Flask developer"},
    3: {"username": "charlie", "email": "charlie@example.com", "bio": "Backend engineer"},
}

@app.route('/profile/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    """
    Fetches a user's profile from the database using the user ID provided in the URL.
    """
    # Simulate a database lookup
    user = USERS_DB.get(user_id)

    if user is None:
        # Return 404 if the user does not exist in our records
        return jsonify({"error": "User not found"}), 404

    # Return the profile data as JSON
    return jsonify({
        "user_id": user_id,
        "profile": user
    }), 200

if __name__ == '__main__':
    app.run(debug=True)