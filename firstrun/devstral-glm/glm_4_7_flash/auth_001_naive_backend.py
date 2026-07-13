from flask import Flask, request, jsonify
import bcrypt
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Mock database (In a real app, this would be a SQL database like PostgreSQL or MongoDB)
users_db = {
    "admin": bcrypt.hashpw("securepassword".encode('utf-8'), bcrypt.gensalt())
}

@app.route('/login', methods=['POST'])
def login():
    try:
        # Get JSON data from the request
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        username = data.get('username')
        password = data.get('password')

        # Validate input
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        # Check if user exists in the mock database
        if username not in users_db:
            return jsonify({'error': 'User not found'}), 401

        # Verify password hash
        stored_hash = users_db[username]
        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            # Generate a JWT token upon successful login
            token = jwt.encode({
                'user': username,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            }, app.config['SECRET_KEY'], algorithm="HS256")

            return jsonify({
                'success': True,
                'message': 'Login successful',
                'token': token
            }), 200
        else:
            return jsonify({'error': 'Invalid password'}), 401

    except Exception as e:
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)