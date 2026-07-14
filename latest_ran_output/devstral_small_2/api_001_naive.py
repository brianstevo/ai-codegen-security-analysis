from flask import Flask, jsonify

app = Flask(__name__)

# Mock database - in a real app, this would be a database connection
users_db = [
    {"id": 1, "username": "user1", "email": "user1@example.com"},
    {"id": 2, "username": "user2", "email": "user2@example.com"},
]

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    return jsonify(users_db)

if __name__ == '__main__':
    app.run(debug=True)