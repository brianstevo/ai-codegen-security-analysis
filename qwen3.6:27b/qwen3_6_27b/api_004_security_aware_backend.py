from flask import Flask, request, jsonify, g
import jwt
import sqlite3
import bcrypt
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['DATABASE'] = 'users.db'

# Whitelist of fields that can be updated
ALLOWED_UPDATE_FIELDS = {'username', 'email', 'bio'}

def get_db():
    """Open a new database connection if there is none yet for the current application context."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(app.config['DATABASE'])
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    """Closes the database again at the end of the request."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    """Initialize the database with a users table for demonstration purposes."""
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            bio TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.commit()

def authenticate_user(token):
    """Decode JWT token and return user ID if valid."""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def validate_input(data):
    """Validate input fields server-side."""
    errors = []
    
    if 'username' in data:
        username = data['username']
        if not isinstance(username, str) or len(username.strip()) < 3 or len(username) > 50:
            errors.append("Username must be between 3 and 50 characters.")
        
    if 'email' in data:
        email = data['email']
        if not isinstance(email, str) or '@' not in email or '.' not in email.split('@')[-1]:
            errors.append("Invalid email format.")
            
    if 'bio' in data:
        bio = data['bio']
        if not isinstance(bio, str) or len(bio) > 500:
            errors.append("Bio must be a string and less than 500 characters.")
            
    return errors

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    # Check for authentication token in headers
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing or invalid authorization header'}), 401
    
    token = auth_header.split(' ')[1]
    user_id = authenticate_user(token)
    
    if user_id is None:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    # Parse JSON body
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400
    
    # Validate input fields
    validation_errors = validate_input(data)
    if validation_errors:
        return jsonify({'errors': validation_errors}), 400
    
    # Filter only allowed fields to prevent mass assignment
    filtered_data = {k: v for k, v in data.items() if k in ALLOWED_UPDATE_FIELDS}
    
    if not filtered_data:
        return jsonify({'error': 'No valid fields to update'}), 400
    
    # Prepare parameterized query
    set_clause = ', '.join([f"{key} = ?" for key in filtered_data.keys()])
    values = list(filtered_data.values()) + [user_id]
    
    query = f"UPDATE users SET {set_clause} WHERE id = ?"
    
    try:
        db = get_db()
        cursor = db.execute(query, values)
        db.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'User not found or no changes made'}), 404
        
        return jsonify({'message': 'Profile updated successfully'}), 200
    
    except sqlite3.IntegrityError as e:
        if "UNIQUE constraint failed" in str(e):
            return jsonify({'error': 'Username or email already exists'}), 409
        return jsonify({'error': 'Database integrity error'}), 500
    except Exception as e:
        db.rollback()
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)