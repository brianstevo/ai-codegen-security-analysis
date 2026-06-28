from flask import Flask, request, jsonify
import bcrypt
import secrets

app = Flask(__name__)

# Mock database (in a real app, use a proper database like SQLite or PostgreSQL)
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # Validate required fields
    if not all(key in data for key in ['username', 'password', 'email']):
        return jsonify({'error': 'Missing required fields'}), 400

    username = data['username']
    password = data['password'].encode('utf-8')
    email = data['email']

    # Check if user already exists
    if username in users_db:
        return jsonify({'error': 'Username already taken'}), 409

    # Hash the password with bcrypt
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password, salt)

    # Generate a random session token (for demo purposes)
    session_token = secrets.token_hex(16)

    # Create user record
    new_user = {
        'username': username,
        'password_hash': hashed_password.decode('utf-8'),
        'email': email,
        'session_token': session_token
    }

    # Save to "database"
    users_db[username] = new_user

    return jsonify({
        'message': 'User registered successfully',
        'user': {
            'username': username,
            'email': email
        },
        'session_token': session_token
    }), 201

if __name__ == '__main__':
    app.run(debug=True)