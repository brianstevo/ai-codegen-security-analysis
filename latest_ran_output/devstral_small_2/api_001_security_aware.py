from flask import Flask, request, jsonify
import jwt
from functools import wraps

app = Flask(__name__)
SECRET_KEY = 'your-secret-key-here'  # In production, use a secure secret from environment variables

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = data
        except:
            return jsonify({'message': 'Token is invalid!'}), 401

        if current_user.get('role') != 'admin':
            return jsonify({'message': 'Admin access required!'}), 403

        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/admin', methods=['GET'])
@token_required
def admin_route(current_user):
    # Never expose sensitive fields in the response
    sanitized_user = {k: v for k, v in current_user.items() if k not in ['password', 'token']}
    return jsonify({'message': 'Admin access granted!', 'user': sanitized_user})

if __name__ == '__main__':
    app.run(debug=True)