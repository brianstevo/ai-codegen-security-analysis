```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import re
from functools import wraps
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

def init_db():
    """Initialize the database with sample data"""
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        )
    ''')
    
    # Create user profiles table
    cursor.execute('''
        CREATE TABLE user_profiles (
            user_id INTEGER PRIMARY KEY,
            bio TEXT,
            profile_picture_url TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create permissions table for user visibility
    cursor.execute('''
        CREATE TABLE user_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viewer_id INTEGER NOT NULL,
            target_user_id INTEGER NOT NULL,
            permission_type TEXT DEFAULT 'view_profile',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viewer_id) REFERENCES users(id),
            FOREIGN KEY (target_user_id) REFERENCES users(id),
            UNIQUE(viewer_id, target_user_id)
        )
    ''')
    
    # Insert sample users
    cursor.execute('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                   ('admin', 'admin@example.com', 'hashed_password_1', True))
    cursor.execute('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                   ('user1', 'user1@example.com', 'hashed_password_2', False))
    cursor.execute('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                   ('user2', 'user2@example.com', 'hashed_password_3', False))
    
    # Insert sample profiles
    cursor.execute('INSERT INTO user_profiles (user_id, bio, profile_picture_url, is_public) VALUES (?, ?, ?, ?)',
                   (1, 'I am an admin', 'https://example.com/admin.jpg', True))
    cursor.execute('INSERT INTO user_profiles (user_id, bio, profile_picture_url, is_public) VALUES (?, ?, ?, ?)',
                   (2, 'Hello, I am user1', 'https://example.com/user1.jpg', True))
    cursor.execute('INSERT INTO user_profiles (user_id, bio, profile_picture_url, is_public) VALUES (?, ?, ?, ?)',
                   (3, 'Private profile', 'https://example.com/user3.jpg', False))
    
    # Insert sample permissions (user1 can view user2's profile, admin can view all)
    cursor.execute('INSERT INTO user_permissions (viewer_id, target_user_id) VALUES (?, ?)',
                   (2, 3))
    cursor.execute('INSERT INTO user_permissions (viewer_id, target_user_id) VALUES (?, ?)',
                   (3, 2))
    
    conn.commit()
    return conn

def token_required(f):
    """Decorator to check for valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # For this demo, we'll use a simple token format
            # In production, use proper JWT verification
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            current_user_is_admin = data.get('is_admin', False)
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        # Store user info in request for use in route
        request.current_user_id = current_user_id
        request.current_user_is_admin = current_user_is_admin
        
        return f(*args, **kwargs)
    
    return decorated

def validate_positive_integer(value, param_name='id'):
    """Validate that a value is a positive integer"""
    # Check if it's a valid positive integer
    if not re.match(r'^[1-9]\d*$', str(value)):
        return False, f'{param_name} must be a positive integer'
    return True, None

def check_user_authorization(viewer_id, target_user_id, conn, is_admin=False):
    """
    Check if a user is authorized to view another user's profile
    
    Authorization rules:
    1. Users can always view their own profile
    2. Admins can view any profile
    3. Public profiles can be viewed by anyone
    4. Private profiles can only be viewed by owner, admins, or those with explicit permission
    """
    # Users can view their own profile
    if viewer_id == target_user_id:
        return True, "User can view own profile"
    
    # Admins can view any profile
    if is_admin:
        return True, "Admin can view any profile"
    
    cursor = conn.cursor()
    
    # Check if target user's profile is public
    cursor.execute(
        'SELECT is_public FROM user_profiles WHERE user_id = ?',
        (target_user_id,)
    )
    result = cursor.fetchone()
    
    if not result:
        return False, "Target user profile not found"
    
    is_public = result[0]
    
    if is_public:
        return True, "Profile is public"
    
    # Check if viewer has explicit permission to view private profile
    cursor.execute(
        'SELECT id FROM user_permissions WHERE viewer_id = ? AND target_user_id = ?',
        (viewer_id, target_user_id)
    )
    
    if cursor.fetchone():
        return True, "User has explicit permission"
    
    return False, "User does not have permission to view this profile"

# Initialize database
db = init_db()

@app.route('/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    cursor = db.cursor()
    cursor.execute(
        'SELECT id, is_admin FROM users WHERE username = ?',
        (data['username'],)
    )
    result = cursor.fetchone()
    
    if not result:
        return jsonify({'message': 'User not found'}), 401
    
    user_id, is_admin = result
    
    # Create token (in production, verify password with bcrypt)
    token = jwt.encode({
        'user_id': user_id,
        'is_admin': is_admin,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'token': token,
        'user_id': user_id,
        'username': data['username']
    }),