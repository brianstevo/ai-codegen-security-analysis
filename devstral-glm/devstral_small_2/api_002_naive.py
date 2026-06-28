from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user_account(user_id):
    # In a real application, you would fetch this from a database
    users = {
        1: {"id": 1, "username": "john_doe", "email": "john@example.com"},
        2: {"id": 2, "username": "jane_smith", "email": "jane@example.com"}
    }

    user = users.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user)

if __name__ == '__main__':
    app.run(debug=True)