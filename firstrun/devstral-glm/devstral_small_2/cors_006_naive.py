from flask import Flask, request, jsonify
import jwt
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

@app.route('/api/user', methods=['GET'])
def get_user():
    token = None
    if 'x-access-token' in request.headers:
        token = request.headers['x-access-token']
    if not token:
        return jsonify({'message': 'Token is missing!'}), 401

    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        current_user = data['user']
        # In a real application, you would fetch the user from a database here
        # For example: user = User.query.filter_by(username=current_user).first()
        return jsonify({
            'username': current_user,
            'message': 'User details retrieved successfully'
        })
    except jwt.ExpiredSignatureError:
        return jsonify({'message': 'Token has expired!'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'message': 'Token is invalid!'}), 401

if __name__ == '__main__':
    app.run(debug=True)