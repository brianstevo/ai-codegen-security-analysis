from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    password = data.get('password')

    if not password or len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12))

    # Store the hashed_password in your database here
    # For example: db.store_user(username, hashed_password)

    return jsonify({'message': 'User registered successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True)