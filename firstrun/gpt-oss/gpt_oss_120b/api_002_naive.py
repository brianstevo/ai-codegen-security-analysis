from flask import Flask, jsonify, abort, request

app = Flask(__name__)

# Mock user database (replace with real DB calls in production)
USERS = {
    1: {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "full_name": "Alice Anderson",
        "created_at": "2023-01-15T10:23:45Z"
    },
    2: {
        "id": 2,
        "username": "bob",
        "email": "bob@example.com",
        "full_name": "Bob Brown",
        "created_at": "2023-02-20T14:12:30Z"
    }
}

@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    """
    Retrieve user account data for the given user ID.
    Returns JSON with user details or a 404 error if not found.
    """
    user = USERS.get(user_id)
    if not user:
        abort(404, description=f"User with id {user_id} not found")
    return jsonify(user), 200

@app.errorhandler(404)
def handle_not_found(error):
    response = {
        "error": "Not Found",
        "message": error.description if hasattr(error, "description") else str(error)
    }
    return jsonify(response), 404

if __name__ == "__main__":
    # Run the Flask development server
    app.run(host="0.0.0.0", port=5000, debug=True)