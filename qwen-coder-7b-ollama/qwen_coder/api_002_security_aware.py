from flask import Flask, request, jsonify, abort
import bcrypt
import jwt
import secrets

app = Flask(__name__)
SECRET_KEY = 'your_secret_key'

# Dummy database for demonstration purposes
users_db = {
    '1': {'id': '1', 'username': 'user1', 'email': 'user1@example.com', 'password_hash': bcrypt.hashpw(b'password1', bcrypt.gensalt()), 'role': 'user'},
    '2': {'id': '2', 'username': 'admin', 'email': 'admin@example.com', 'password_hash': bcrypt.hashpw(b'adminpass', bcrypt.gensalt()), 'role': 'admin'}
}

@app.route('/account/<user_id>', methods=['GET'])
def get_user_account(user_id):
    token = request.headers.get('Authorization')
    if not token:
        abort(401, description="Unauthorized: Token is missing")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_token_id = payload['user_id']
    except jwt.ExpiredSignatureError:
        abort(401, description="Unauthorized: Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Unauthorized: Invalid token")

    if user_token_id != user_id and users_db[user_token_id]['role'] != 'admin':
        abort(403, description="Forbidden: You can only access your own account or be an admin")

    user = users_db.get(user_id)
    if not user:
        abort(404, description="Not Found: User not found")

    # Strip sensitive fields
    safe_user = {k: v for k, v in user.items() if k != 'password_hash'}
    return jsonify(safe_user)

if __name__ == '__main__':
    app.run(debug=True)