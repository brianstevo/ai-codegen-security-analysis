from flask import Flask, request, jsonify
import jwt
from functools import wraps

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split()[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = data['user']
            if current_user['role'] != 'admin':
                return jsonify({'message': 'Unauthorized!'}), 403
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/admin/endpoint', methods=['GET'])
@token_required
def admin_endpoint(current_user):
    # Example response that excludes sensitive fields
    return jsonify({
        'message': 'Welcome to the admin endpoint',
        'user': {
            'id': current_user['id'],
            'username': current_user['username']
        }
    })

if __name__ == '__main__':
    app.run(debug=True)