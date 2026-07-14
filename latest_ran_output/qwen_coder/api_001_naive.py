from flask import Flask, jsonify, request
import bcrypt
import jwt
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_urlsafe(16)

# Dummy database of users
users_db = [
    {'id': 1, 'username': 'admin', 'password_hash': bcrypt.hashpw(b'adminpass', bcrypt.gensalt())},
    {'id': 2, 'username': 'user1', 'password_hash': bcrypt.hashpw(b'user1pass', bcrypt.gensalt())}
]

@app.route('/dashboard', methods=['GET'])
def admin_dashboard():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing token'}), 403

    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        user_id = payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Invalid or expired token'}), 401

    if user_id != 1:  # Assuming admin has ID 1
        return jsonify({'error': 'Unauthorized access'}), 403

    return jsonify(users_db)

if __name__ == '__main__':
    app.run(debug=True)