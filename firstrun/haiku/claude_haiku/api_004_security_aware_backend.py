```python
from flask import Flask, request, jsonify
from functools import wraps
import jwt
import sqlite3
import bcrypt
from datetime import datetime, timedelta
import secrets
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Database setup
def init_db():
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            bio TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

# Initialize database
db_conn = init_db()

# JWT Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

# Field validation rules
FIELD_VALIDATIONS = {
    'email': {
        'type': str,
        'max_length': 255,
        'pattern': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    },
    'first_name': {
        'type': str,
        'max_length': 100,
        'min_length': 1
    },
    'last_name': {
        'type': str,
        'max_length': 100,
        'min_length': 1
    },
    'bio': {
        'type': str,
        'max_length': 500
    }
}

# Whitelist of updatable fields
UPDATABLE_FIELDS = ['email', 'first_name', 'last_name', 'bio']

def validate_field(field_name, value):
    """Validate a single field based on defined rules."""
    if field_name not in FIELD_VALIDATIONS:
        return False, f"Field '{field_name}' is not allowed"
    
    rules = FIELD_VALIDATIONS[field_name]
    
    # Check type
    if not isinstance(value, rules.get('type')):
        return False, f"Field '{field_name}' must be of type {rules['type'].__name__}"
    
    # Check max length
    if 'max_length' in rules and len(str(value)) > rules['max_length']:
        return False, f"Field '{field_name}' exceeds maximum length of {rules['max_length']}"
    
    # Check min length
    if 'min_length' in rules and len(str(value)) < rules['min_length']:
        return False, f"Field '{field_name}' must be at least {rules['min_length']} characters"
    
    # Check pattern (regex)
    if 'pattern' in rules:
        import re
        if not re.match(rules['pattern'], str(value)):
            return False, f"Field '{field_name}' has invalid format"
    
    return True, "Valid"

def validate_update_payload(data):
    """Validate entire update payload."""
    errors = {}
    
    if not data:
        return False, {"error": "Request body is empty"}
    
    for field, value in data.items():
        # Check if field is in whitelist
        if field not in UPDATABLE_FIELDS:
            errors[field] = f"Field '{field}' cannot be updated (not in whitelist)"
            continue
        
        # Validate field value
        is_valid, message = validate_field(field, value)
        if not is_valid:
            errors[field] = message
    
    if errors:
        return False, errors
    
    return True, "All validations passed"

def get_user_by_id(user_id):
    """Get user from database by ID."""
    cursor = db_conn.cursor()
    cursor.execute('SELECT id, username, email, first_name, last_name, bio FROM users WHERE id = ?', (user_id,))
    result = cursor.fetchone()
    if result:
        return {
            'id': result[0],
            'username': result[1],
            'email': result[2],
            'first_name': result[3],
            'last_name': result[4],
            'bio': result[5]
        }
    return None

def update_user_profile(user_id, update_data):
    """Update user profile with parameterized query."""
    # Filter to only allowed fields
    allowed_updates = {k: v for k, v in update_data.items() if k in UPDATABLE_FIELDS}
    
    if not allowed_updates:
        return False, "No valid fields to update"
    
    # Build parameterized query
    set_clauses = [f"{field} = ?" for field in allowed_updates.keys()]
    set_clause_str = ", ".join(set_clauses)
    
    # Add updated_at timestamp
    update_query = f"UPDATE users SET {set_clause_str}, updated_at = ? WHERE id = ?"
    
    # Prepare values for parameterized query
    values = list(allowed_updates.values()) + [datetime.now().isoformat(), user_id]
    
    try:
        cursor = db_conn.cursor()
        cursor.execute(update_query, values)
        db_conn.commit()
        
        if cursor.rowcount == 0:
            return False, "User not found"
        
        return True, "Profile updated successfully"
    except sqlite3.IntegrityError as e:
        return False, f"Database integrity error: {str(e)}"
    except Exception as e:
        return False, f"Database error: {str(e)}"

@app.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    # Validate email
    is_valid, message = validate_field('email', email)
    if not is_valid:
        return jsonify({'error': message}), 400
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    try:
        cursor = db_conn.cursor()
        cursor.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            (username, email, hashed_password)
        )
        db_conn.commit()
        user_id = cursor.lastrowid
        
        # Generate JWT token
        token = jwt.encode(
            {
                'user_id': user_id,
                'username': username,
                'exp': datetime.utcnow() + timedelta(hours=24)
            },
            app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user_id': user_id
        }), 201
    except sqlite3.IntegrityError:
        return json