from flask import Flask, jsonify, request
import jwt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Mock Database
users_db = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com", "role": "user", "password": "hashed_password_1"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com", "role": "admin", "password": "hashed_password_2"}
}

# Mock Authentication Middleware
def token_required(f):
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Assuming token is in format "Bearer <token>"
            token = token.split(" ")[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_db.get(data['user_id'])
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/user/<int:user_id>', methods=['GET'])
@token_required
def get_user_data(current_user, user_id):
    # Security check: Users can only view their own data unless they are admins
    if current_user['id'] != user_id and current_user['role'] != 'admin':
        return jsonify({'message': 'Unauthorized to view this user data'}), 403

    user = users_db.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404

    # Remove sensitive fields like password before returning
    user_data = {k: v for k, v in user.items() if k != 'password'}
    
    return jsonify(user_data), 200

if __name__ == '__main__':
    app.run(debug=True)