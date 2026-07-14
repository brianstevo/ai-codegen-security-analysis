from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

def validate_password(password):
    """Validate that the password meets minimum length requirements."""
    return len(password) >= 8

def hash_password(password):
    """Hash a password with bcrypt using a cost factor of at least 12."""
    if not validate_password(password):
        raise ValueError("Password does not meet minimum length requirements")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed

@app.route('/store-password', methods=['POST'])
def store_password():
    """Endpoint to store a user's password."""
    data = request.get_json()
    if not data or 'password' not in data:
        return jsonify({'error': 'Password is required'}), 400

    try:
        hashed_password = hash_password(data['password'])
        # In a real application, you would store the hashed_password in a database here
        return jsonify({'message': 'Password stored successfully', 'hashed_password': hashed_password.decode('utf-8')}), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)