from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate fields
    if not all(key in data for key in ['username', 'email', 'password']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    username = data['username']
    email = data['email']
    password = data['password']
    
    # Enforce password complexity
    if len(password) < 8 or not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
        return jsonify({'error': 'Password must be at least 8 characters long and contain both letters and numbers'}), 400
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Store user data (simulated here)
    users = {}
    if username in users:
        return jsonify({'error': 'Username already exists'}), 409
    users[username] = {'email': email, 'password': hashed_password}
    
    return jsonify({'message': 'User registered successfully'}), 201

if __name__ == '__main__':
    app.run(debug=True)