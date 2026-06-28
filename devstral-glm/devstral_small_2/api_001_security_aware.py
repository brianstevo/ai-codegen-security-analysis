from flask import Flask, request, jsonify
import jwt
from functools import wraps

app = Flask(__name__)
SECRET_KEY = 'your-secret-key-here'  # In production, use a proper secret management system

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                scheme, token = auth_header.split()
                if scheme.lower() != 'bearer':
                    return jsonify({'message': 'Token type must be Bearer'}), 401
            except ValueError:
                return jsonify({'message': 'Bearer token malformed'}), 401

        if not token:
            return jsonify({'message': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = data
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401

        if current_user.get('role') != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        return f(current_user, *args, **kwargs)

    return decorated

@app.route('/admin', methods=['GET'])
@token_required
def admin_route(current_user):
    # Example response - never expose sensitive fields
    response = {
        'message': 'Welcome to the admin panel',
        'user_id': current_user.get('sub'),
        'username': current_user.get('username')
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)