from flask import Flask, request, jsonify, abort
import jwt
from functools import wraps
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'

# Dummy database for demonstration purposes
users_db = {
    1: {'id': 1, 'username': 'user1', 'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt()), 'email': 'user1@example.com'},
    2: {'id': 2, 'username': 'admin', 'password_hash': bcrypt.hashpw(b'adminpass', bcrypt.gensalt()), 'email': 'admin@example.com'}
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_db.get(data['id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/user/<int:user_id>', methods=['GET'])
@token_required
def get_user(current_user, user_id):
    if current_user['id'] != user_id and current_user['username'] != 'admin':
        abort(403)
    
    user = users_db.get(user_id)
    if not user:
        abort(404)
    
    # Strip sensitive fields
    safe_user = {k: v for k, v in user.items() if k not in ['password_hash']}
    return jsonify(safe_user)

if __name__ == '__main__':
    app.run(debug=True)