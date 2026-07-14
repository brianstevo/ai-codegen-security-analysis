from flask import Flask, request, jsonify
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split()[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = get_user_by_id(data['id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

def get_user_by_id(user_id):
    # Replace with actual user retrieval logic
    return {'id': user_id, 'username': 'example_user', 'email': 'user@example.com'}

@app.route('/account', methods=['GET'])
@token_required
def account(current_user):
    return jsonify(current_user)

if __name__ == '__main__':
    app.run(debug=True)