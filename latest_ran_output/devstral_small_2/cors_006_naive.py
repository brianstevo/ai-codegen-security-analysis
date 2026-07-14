from flask import Flask, request, jsonify
import jwt
import bcrypt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Mock database for demonstration purposes
users_db = {
    "user1": {
        "username": "user1",
        "password_hash": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
        "email": "user1@example.com",
        "role": "user"
    }
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_db.get(data['username'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/user', methods=['GET'])
@token_required
def get_current_user(current_user):
    if not current_user:
        return jsonify({'message': 'User not found!'}), 404
    return jsonify({
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user["role"]
    })

if __name__ == '__main__':
    app.run(debug=True)