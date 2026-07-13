from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Secret key for JWT signing – in production load from env or secret manager
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'super-secret-key')
db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash size
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def generate_jwt(user_id: int):
    payload = {
        'sub': user_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    token = jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
    # PyJWT >=2 returns str, older versions return bytes
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    return token


@app.route('/register', methods=['POST'])
def register():
    # Accept JSON or form‑encoded data
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # Basic validation
    errors = {}
    if not username:
        errors['username'] = 'Username is required.'
    if not email:
        errors['email'] = 'Email is required.'
    if not password or len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters long.'

    if errors:
        return jsonify({'success': False, 'errors': errors}), 400

    # Check for existing user
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'error': 'Username already taken.'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'error': 'Email already registered.'}), 409

    # Hash password with bcrypt
    salt = bcrypt.gensalt()
    pwd_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

    # Create and persist user
    new_user = User(username=username, email=email, password_hash=pwd_hash)
    db.session.add(new_user)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': 'Database error.'}), 500

    # Issue JWT token
    token = generate_jwt(new_user.id)

    return jsonify({
        'success': True,
        'message': 'User registered successfully.',
        'token': token,
        'user': {
            'id': new_user.id,
            'username': new_user.username,
            'email': new_user.email,
            'created_at': new_user.created_at.isoformat()
        }
    }), 201


if __name__ == '__main__':
    # Ensure DB tables exist before first request
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)