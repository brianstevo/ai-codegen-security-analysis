from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    bio = db.Column(db.String(255), nullable=True)

with app.app_context():
    db.create_all()

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            # Expecting "Bearer <token>"
            token = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'User not found!'}), 404
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    """
    Updates the authenticated user's profile information.
    Expected JSON body: { "email": "...", "bio": "...", "password": "..." }
    """
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided'}), 400

    # Define fields that are allowed to be updated via this route
    updatable_fields = ['email', 'bio', 'password']
    
    try:
        for field in updatable_fields:
            if field in data:
                value = data[field]
                
                # Special handling for password hashing
                if field == 'password':
                    if not value or len(value) < 6:
                        return jsonify({'message': 'Password must be at least 6 characters'}), 400
                    hashed_pw = bcrypt.generate_password_hash(value).decode('utf-8')
                    setattr(current_user, field, hashed_pw)
                else:
                    # Basic validation for email if provided
                    if field == 'email' and '@' not in value:
                        return jsonify({'message': 'Invalid email format'}), 400
                    setattr(current_user, field, value)

        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'username': current_user.username,
                'email': current_user.email,
                'bio': current_user.bio
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'An error occurred while updating profile', 'error': str(e)}), 500

# Helper route to generate a token for testing purposes
@app.route('/test-token/<int:user_id>', methods=['GET'])
def get_test_token(user_id):
    token = jwt.encode({
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)