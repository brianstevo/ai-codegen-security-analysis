from flask import Flask, jsonify, abort

app = Flask(__name__)

# Example in-memory datastore
USERS = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com", "role": "user"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com", "role": "admin"},
    3: {"id": 3, "username": "charlie", "email": "charlie@example.com", "role": "user"},
}

@app.route("/users/<int:user_id>", methods=["GET"])
def get_user_account(user_id: int):
    user = USERS.get(user_id)
    if not user:
        abort(404, description="User not found")
    return jsonify(user), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not Found", "message": str(error)}), 404

if __name__ == "__main__":
    app.run(debug=True)