from flask import Flask, jsonify, request
import jwt
import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key')

# Mock database for demonstration purposes
users_db = {
    1: {"id": 1, "username": "jdoe", "email": "jdoe@example.com", "role": "admin"},
    2: {"id": 2, "username": "alice", "email": "alice@example.com", "role": "user"}
}

def token_required(f):
    """
    Decorator to verify the JWT token in the Authorization header.
    """
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token.split(' ')[1]

            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
            current_user = users_db.get(current_user_id)

            if not current_user:
                return jsonify({'message': 'User not found!'}), 404

            return f(current_user, *args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401

    return decorated

@app.route('/user/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """
    Route to return the details of the currently logged-in user.
    """
    return jsonify({
        'id': current_user['id'],
        'username': current_user['username'],
        'email': current_user['email'],
        'role': current_user['role']
    })

if __name__ == '__main__':
    app.run(debug=True)