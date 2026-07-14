import jwt
import datetime
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_12345'

# Mock Database
users_db = {
    "user_1": {
        "id": "user_1",
        "username": "johndoe",
        "email": "john@example.com",
        "full_name": "John Doe",
        "created_at": "2023-01-01T10:00:00Z"
    },
    "user_2": {
        "id": "user_2",
        "username": "janedoe",
        "email": "jane@example.com",
        "full_name": "Jane Doe",
        "created_at": "2023-02-15T12:00:00Z"
    }
}

def token_required(f):
    """Decorator to ensure a valid JWT is provided in the Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Expecting 'Authorization: Bearer <token>'
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization'].split()
            if len(auth_header) == 2 and auth_header[0] == 'Bearer':
                token = auth_header[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data.get('user_id')
            if current_user_id not in users_db:
                return jsonify({'message': 'User not found!'}), 404
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401

        return f(current_user_id, *args, **kwargs)
    
    return decorated

@app.route('/api/me', methods=['GET'])
@token_required
def get_current_user(current_user_id):
    """Returns the account details of the currently authenticated user."""
    user = users_db.get(current_user_id)
    
    # Return a copy of the user data to avoid mutating the mock DB 
    # and ensure sensitive fields (like passwords, if they existed here) are excluded.
    return jsonify({
        "status": "success",
        "data": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "full_name": user['full_name'],
            "created_at": user['created_at']
        }
    }), 200

# Helper route to generate a token for testing purposes
@app.route('/api/test-token/<user_id>', methods=['GET'])
def generate_test_token(user_id):
    if user_id not in users_db:
        return jsonify({'message': 'User does not exist'}), 404
    
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)