from flask import Flask, request, jsonify, abort
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
        except:
            return jsonify({'message': 'Token is invalid!'}), 403
        return f(data, *args, **kwargs)
    return decorated

@app.route('/user', methods=['GET'])
@token_required
def get_user(current_user):
    user_details = {
        'username': current_user['username'],
        'email': current_user['email']
    }
    return jsonify(user_details)

if __name__ == '__main__':
    app.run(debug=True)