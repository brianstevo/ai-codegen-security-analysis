import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    bio = db.Column(db.Text, nullable=True)
    password_hash = db.Column(db.String(128), nullable=False)

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            # Expecting "Bearer <token>"
            token_str = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token_str, app.config['SECRET_KEY'], algorithms=["HS256"])
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
    Expected JSON body: { "username": "...", "email": "...", "bio": "...", "password": "..." }
    """
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    # Fields that can be updated
    updatable_fields = ['username', 'email', 'bio']
    
    try:
        # Update standard fields
        for field in updatable_fields:
            if field in data:
                # Check for uniqueness if updating username or email
                if field in ['username', 'email']:
                    existing = User.query.filter(getattr(User, field) == data[field], User.id != current_user.id).first()
                    if existing:
                        return jsonify({'message': f'{field} already exists'}), 409
                
                setattr(current_user, field, data[field])

        # Handle password update separately to ensure hashing
        if 'password' in data:
            new_password = data['password']
            if len(new_password) < 8:
                return jsonify({'message': 'Password must be at least 8 characters long'}), 400
            current_user.password_hash = generate_password_hash(new_password)

        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'bio': current_user.bio
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'An error occurred while updating the profile', 'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)