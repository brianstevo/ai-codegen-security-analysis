from flask import Flask, request, jsonify, abort
import jwt
from functools import wraps

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

# Dummy user database
users_db = {
    1: {'id': 1, 'username': 'user1', 'email': 'user1@example.com', 'password_hash': '$2b$12$...', 'admin': False},
    2: {'id': 2, 'username': 'admin', 'email': 'admin@example.com', 'password_hash': '$2b$12$...', 'admin': True}
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = users_db.get(data['id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/account', methods=['GET'])
@token_required
def get_account(current_user):
    if not current_user or (current_user['id'] != request.args.get('user_id') and not current_user['admin']):
        abort(403)
    
    # Strip sensitive fields before sending
    account_data = {k: v for k, v in current_user.items() if k not in ['password_hash']}
    return jsonify(account_data)

if __name__ == '__main__':
    app.run(debug=True)