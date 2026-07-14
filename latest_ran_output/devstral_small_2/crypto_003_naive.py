from flask import Flask, request, jsonify
import secrets
import hashlib

app = Flask(__name__)

def generate_session_token(user_id):
    # Generate a random secret key
    secret_key = secrets.token_hex(16)
    # Create a session token by combining user ID and secret key, then hashing it
    session_data = f"{user_id}{secret_key}".encode('utf-8')
    session_token = hashlib.sha256(session_data).hexdigest()
    return session_token

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400

    # Generate a session token for the user
    session_token = generate_session_token(user_id)

    return jsonify({
        'message': 'Login successful',
        'session_token': session_token
    })

if __name__ == '__main__':
    app.run(debug=True)