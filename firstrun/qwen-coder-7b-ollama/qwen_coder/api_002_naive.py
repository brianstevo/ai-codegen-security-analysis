from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# Dummy database simulation
users_db = {
    '1': {'username': 'john_doe', 'email': 'john@example.com', 'password_hash': bcrypt.hashpw(b'password123', bcrypt.gensalt())}
}

@app.route('/user/<user_id>', methods=['GET'])
def get_user(user_id):
    user = users_db.get(user_id)
    if user:
        return jsonify({
            'username': user['username'],
            'email': user['email']
        }), 200
    else:
        return jsonify({'error': 'User not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)