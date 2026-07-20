from flask import Flask, request, jsonify
from functools import wraps
import jwt
from datetime import datetime, timedelta
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Database initialization
def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, email TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS user_profiles
                 (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE, bio TEXT, avatar_url TEXT,
                  visibility TEXT DEFAULT 'private', FOREIGN KEY(user_id) REFERENCES users(id))''')
    
    # Insert sample data
    try:
        c.execute("INSERT INTO users (id, username, password, email) VALUES (1, 'john_doe', 'hashed_password_1', 'john@example.com')")
        c.execute("INSERT INTO users (id, username, password, email) VALUES (2, 'jane_smith', 'hashed_password_2', 'jane@example.com')")
        c.execute("INSERT INTO users (id, username, password, email) VALUES (3, 'bob_wilson', 'hashed_password_3', 'bob@example.com')")
        
        c.execute("INSERT INTO user_profiles (user_id, bio, avatar_url, visibility) VALUES (1, 'Software engineer', 'https://example.com/avatar1.jpg', 'public')")
        c.execute("INSERT INTO user_profiles (user_id, bio, avatar_url, visibility) VALUES (2, 'Designer', 'https://example.com/avatar2.jpg', 'private')")
        c.execute("INSERT INTO user_profiles (user_id, bio, avatar_url, visibility) VALUES (3, 'Product manager', 'https://example.com/avatar3.jpg', 'public')")
        
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    
    conn.close()

init_db()

def generate_token(user_id):
    """Generate JWT token for a user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

def verify_token(f):
    """Decorator to verify JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return {'message': 'Invalid token format'}, 401
        
        if not token:
            return {'message': 'Token is missing'}, 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return {'message': 'Token has expired'}, 401
        except jwt.InvalidTokenError:
            return {'message': 'Invalid token'}, 401
        
        return f(*args, **kwargs)
    
    return decorated

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/users/<profile_id>', methods=['GET'])
@verify_token
def get_user_profile(profile_id):
    """
    Fetch a user profile by ID.
    
    Validates:
    - Profile ID is a positive integer
    - Requesting user is authorized to view the profile
    
    Returns:
    - Profile data if authorized
    - 403 Forbidden if not authorized
    - 404 Not Found if profile doesn't exist
    - 400 Bad Request if ID is invalid
    """
    # Validate that profile_id is a positive integer
    try:
        profile_id_int = int(profile_id)
        if profile_id_int <= 0:
            return {'error': 'Profile ID must be a positive integer'}, 400
    except ValueError:
        return {'error': 'Profile ID must be a valid integer'}, 400
    
    # Get requesting user ID from token
    requesting_user_id = request.user_id
    
    conn = get_db_connection()
    c = conn.cursor()
    
    # Use parameterized query to fetch user profile
    c.execute('''SELECT u.id, u.username, u.email, up.bio, up.avatar_url, up.visibility
                 FROM users u
                 LEFT JOIN user_profiles up ON u.id = up.user_id
                 WHERE u.id = ?''', (profile_id_int,))
    
    profile = c.fetchone()
    conn.close()
    
    if not profile:
        return {'error': 'Profile not found'}, 404
    
    # Check authorization
    profile_dict = dict(profile)
    visibility = profile_dict.get('visibility', 'public')
    
    # User can always see their own profile
    if requesting_user_id == profile_id_int:
        return {
            'id': profile_dict['id'],
            'username': profile_dict['username'],
            'email': profile_dict['email'],
            'bio': profile_dict['bio'],
            'avatar_url': profile_dict['avatar_url'],
            'visibility': visibility
        }, 200
    
    # Check visibility for other profiles
    if visibility == 'private':
        return {'error': 'Access denied. This profile is private.'}, 403
    
    # Return public profile (without email)
    return {
        'id': profile_dict['id'],
        'username': profile_dict['username'],
        'bio': profile_dict['bio'],
        'avatar_url': profile_dict['avatar_url'],
        'visibility': visibility
    }, 200

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint to get authentication token"""
    data = request.get_json()
    
    if not data or not data.get('user_id'):
        return {'error': 'user_id is required'}, 400
    
    try:
        user_id = int(data['user_id'])
        if user_id <= 0:
            return {'error': 'user_id must be a positive integer'}, 400
    except ValueError:
        return {'error': 'user_id must be a valid integer'}, 400
    
    # Verify user exists
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
    user = c.fetchone()
    conn.close()
    
    if not user:
        return {'error': 'User not found'}, 404
    
    token = generate_token(user_id)
    return {'token': token}, 200

if __name__ == '__main__':
    app.run(debug=True)