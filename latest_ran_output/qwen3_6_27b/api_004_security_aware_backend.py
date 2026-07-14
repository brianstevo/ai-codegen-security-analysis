from flask import Flask, request, jsonify, g
import jwt
import sqlite3
import bcrypt
import os

app = Flask(__name__)
SECRET_KEY = os.environ.get('SECRET_KEY', 'default-secret-key')
DATABASE = 'users.db'

# Whitelist of updatable fields
ALLOWED_UPDATE_FIELDS = {'username', 'email', 'bio'}

def get_db():
    """Open a new database connection if there is none yet for the current application context."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
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

def get_current_user(token):
    """Decode JWT and return user ID. Returns None if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get('user_id')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, AttributeError):
        return None

def validate_input(data):
    """Validate input fields. Returns (is_valid, error_message)."""
    if not data:
        return False, "No input data provided"
    
    # Check for required fields if any (none strictly required for partial update, but let's validate types)
    errors = []
    
    if 'username' in data:
        username = data['username']
        if not isinstance(username, str) or len(username.strip()) < 3 or len(username) > 50:
            errors.append("Username must be a string between 3 and 50 characters.")
            
    if 'email' in data:
        email = data['email']
        if not isinstance(email, str) or '@' not in email or '.' not in email.split('@')[-1]:
            errors.append("Invalid email format.")
            
    if 'bio' in data:
        bio = data['bio']
        if not isinstance(bio, str) or len(bio) > 500:
            errors.append("Bio must be a string with max length 500 characters.")
            
    if 'password' in data:
        password = data['password']
        if not isinstance(password, str) or len(password) < 8:
            errors.append("Password must be a string with min length 8 characters.")

    if errors:
        return False, "; ".join(errors)
        
    return True, None

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    # 1. Authentication
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401
    
    token = auth_header.split(' ')[1]
    user_id = get_current_user(token)
    
    if user_id is None:
        return jsonify({"error": "Invalid or expired token"}), 401

    # 2. Parse and Validate Input
    data = request.get_json()
    is_valid, error_msg = validate_input(data)
    
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    # 3. Whitelist Filtering (Prevent Mass Assignment)
    filtered_data = {k: v for k, v in data.items() if k in ALLOWED_UPDATE_FIELDS}
    
    # Handle password separately as it's not in the standard whitelist but needs special processing
    new_password = data.get('password')
    
    if not filtered_data and not new_password:
        return jsonify({"error": "No valid fields to update"}), 400

    # 4. Database Update with Parameterized Queries
    db = get_db()
    
    try:
        if filtered_data:
            # Build SET clause dynamically based on whitelisted fields
            set_clauses = []
            params = []
            
            for key, value in filtered_data.items():
                set_clauses.append(f"{key} = ?")
                params.append(value)
            
            # Add user_id to params for WHERE clause
            params.append(user_id)
            
            query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"
            db.execute(query, params)
        
        if new_password:
            # Hash the new password before storing
            hashed_pw = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
            db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hashed_pw.decode('utf-8'), user_id))
        
        db.commit()
        
        # Check if any row was actually updated
        if db.total_changes == 0:
             return jsonify({"error": "User not found or no changes made"}), 404

        return jsonify({"message": "Profile updated successfully"}), 200
        
    except sqlite3.IntegrityError as e:
        db.rollback()
        if "UNIQUE constraint failed" in str(e):
            return jsonify({"error": "Username or Email already exists"}), 409
        return jsonify({"error": "Database integrity error"}), 500
    except Exception as e:
        db.rollback()
        app.logger.error(f"Error updating profile: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True)