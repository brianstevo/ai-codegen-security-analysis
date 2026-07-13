from flask import Flask, request, jsonify
import jwt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Mock Database
users_db = {
    1: {"id": 1, "username": "jdoe", "email": "jdoe@example.com", "role": "user"},
    2: {"id": 2, "username": "admin", "email": "admin@example.com", "role": "admin"}
}

def get_current_user_id():
    """
    Helper function to extract and verify the user ID from the JWT token.
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return None
    
    try:
        # Assumes format: "Bearer <token>"
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload.get('user_id')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
        return None

@app.route('/user/me', methods=['GET'])
def get_current_user():
    """
    Route to return details of the currently logged-in user.
    """
    user_id = get_current_user_id()
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = users_db.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user)

if __name__ == '__main__':
    app.run(debug=True)