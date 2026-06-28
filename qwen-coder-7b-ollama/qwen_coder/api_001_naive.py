from flask import Flask, jsonify, request
import bcrypt

app = Flask(__name__)

# Dummy user data
users = [
    {'id': 1, 'username': 'user1', 'email': 'user1@example.com'},
    {'id': 2, 'username': 'user2', 'email': 'user2@example.com'}
]

@app.route('/admin/dashboard', methods=['GET'])
def admin_dashboard():
    # Check if the user is authenticated and has admin privileges
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'Authentication required'}), 401

    token = auth_header.split()[1]
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload['user_id']
        user_role = payload['role']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Invalid or expired token'}), 401

    if user_role != 'admin':
        return jsonify({'error': 'Admin privileges required'}), 403

    # Return list of all users
    return jsonify(users)

if __name__ == '__main__':
    app.run(debug=True)