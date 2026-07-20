```python
from flask import Flask, request, jsonify
from functools import wraps
import jwt
import os
from datetime import datetime, timedelta
import sqlite3
from contextlib import contextmanager
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Database setup
DATABASE = ':memory:'

@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                bio TEXT,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

def create_access_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

def validate_email(email):
    if not email or len(email) > 254:
        return False
    if '@' not in email:
        return False
    local, domain = email.rsplit('@', 1)
    if not local or len(local) > 64:
        return False
    if not domain or '.' not in domain:
        return False
    return True

def validate_username(username):
    if not username or len(username) < 3 or len(username) > 30:
        return False
    if not all(c.isalnum() or c in '_-' for c in username):
        return False
    return True

def validate_string_field(value, min_length=0, max_length=500, allow_empty=True):
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    if not allow_empty and len(value) == 0:
        return False
    if len(value) < min_length or len(value) > max_length:
        return False
    return True

def get_validation_errors(data, allowed_fields):
    errors = {}
    
    # Check for invalid fields (mass assignment prevention)
    for field in data.keys():
        if field not in allowed_fields:
            errors[field] = f'Field "{field}" cannot be updated'
    
    # Validate each field if present
    if 'email' in data:
        if not validate_email(data['email']):
            errors['email'] = 'Invalid email format'
    
    if 'username' in data:
        if not validate_username(data['username']):
            errors['username'] = 'Username must be 3-30 characters, alphanumeric with - or _'
    
    if 'first_name' in data:
        if not validate_string_field(data['first_name'], max_length=50, allow_empty=True):
            errors['first_name'] = 'First name must be 0-50 characters'
    
    if 'last_name' in data:
        if not validate_string_field(data['last_name'], max_length=50, allow_empty=True):
            errors['last_name'] = 'Last name must be 0-50 characters'
    
    if 'bio' in data:
        if not validate_string_field(data['bio'], max_length=500, allow_empty=True):
            errors['bio'] = 'Bio must be 0-500 characters'
    
    if 'avatar_url' in data:
        if not validate_string_field(data['avatar_url'], max_length=2048, allow_empty=True):
            errors['avatar_url'] = 'Avatar URL must be 0-2048 characters'
    
    return errors

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
    except:
        return jsonify({'error': 'Invalid JSON'}), 400
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Validate required fields
    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required'}), 400
    
    if not validate_username(data['username']):
        return jsonify({'error': 'Invalid username format'}), 400
    
    if not validate_email(data['email']):
        return jsonify({'error': 'Invalid email format'}), 400
    
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    with get_db() as conn:
        try:
            cursor = conn.execute(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                (data['username'], data['email'], password_hash)
            )
            conn.commit()
            user_id = cursor.lastrowid
            
            token = create_access_token(user_id)
            return jsonify({
                'message': 'User registered successfully',
                'user_id': user_id,
                'token': token
            }), 201
        except sqlite3.IntegrityError as e:
            if 'username' in str(e):
                return jsonify({'error': 'Username already exists'}), 409
            elif 'email' in str(e):
                return jsonify({'error': 'Email already exists'}), 409
            return jsonify({'error': 'Registration failed'}), 409

@app.route('/profile/<int:user_id>', methods=['PUT'])
@token_required
def update_profile(current_user_id, user_id):
    # Authorization check - users can only update their own profile
    if current_user_id != user_id:
        return jsonify({'error': 'You can only update your own profile'}), 403
    
    try:
        data = request.get_json()
    except:
        return jsonify({'error': 'Invalid JSON'}), 400
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Whitelist of fields that can be updated
    allowed_fields = {'email', 'username', 'first_name', 'last_name', 'bio', 'avatar_url'}
    
    # Validate all input fields
    validation_errors = get_validation_errors(data, allowed_fields)
    if validation_errors:
        return jsonify({'errors': validation_errors}), 400