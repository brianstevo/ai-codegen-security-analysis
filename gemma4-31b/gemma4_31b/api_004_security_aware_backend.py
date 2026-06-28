import sqlite3
import jwt
import bcrypt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timezone

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key_123'
DATABASE = 'users.db'

# Whitelist of fields that are allowed to be updated via this endpoint
# This prevents "Mass Assignment" vulnerabilities
ALLOWED_UPDATABLE_FIELDS = {'display_name', 'bio', 'location', 'phone'}

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
            current_user_id = data['user_id']
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user_id, *args, **kwargs)
    return decorated

def validate_profile_data(data):
    """
    Server-side validation for input fields.
    Returns (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Invalid request body"

    # Validation rules for specific fields if they are present in the request
    if 'display_name' in data:
        val = data['display_name']
        if not isinstance(val, str) or len(val) < 2 or len(val) > 50:
            return False, "display_name must be a string between 2 and 50 characters"

    if 'bio' in data:
        val = data['bio']
        if not isinstance(val, str) or len(val) > 500:
            return False, "bio must be a string under 500 characters"

    if 'location' in data:
        val = data['location']
        if not isinstance(val, str) or len(val) > 100:
            return False, "location must be a string under 100 characters"

    if 'phone' in data:
        val = data['phone']
        if not isinstance(val, str) or len(val) < 7 or len(val) > 20:
            return False, "phone must be a valid string length"

    return True, None

@app.route('/user/profile/<int:user_id>', methods=['PUT'])
@token_required
def update_profile(current_user_id, user_id):
    # 1. Authorization Check: Ensure authenticated user can only update their own profile
    if current_user_id != user_id:
        return jsonify({'message': 'Unauthorized to update this profile'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    # 2. Server-side Validation
    is_valid, error_msg = validate_profile_data(data)
    if not is_valid:
        return jsonify({'message': error_msg}), 400

    # 3. Mass Assignment Prevention: Filter input against whitelist
    update_payload = {k: v for k, v in data.items() if k in ALLOWED_UPDATABLE_FIELDS}
    
    if not update_payload:
        return jsonify({'message': 'No valid fields provided for update'}), 400

    # 4. Parameterized Query to prevent SQL Injection
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        # Dynamically build the SET clause based on whitelisted keys
        fields = [f"{key} = ?" for key in update_payload.keys()]
        query = f"UPDATE users SET {', '.join(fields)} WHERE id = ?"
        
        # Values are passed as a tuple to ensure parameterization
        values = list(update_payload.values()) + [user_id]

        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'User not found'}), 404

        conn.close()
    except sqlite3.Error as e:
        return jsonify({'message': f'Database error: {str(e)}'}), 500

    return jsonify({'message': 'Profile updated successfully', 'updated_fields': list(update_payload.keys())}), 200

# --- Setup for demonstration purposes ---
def init_db():
    conn = sqlite3.connect(DATABASE)
    conn.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, bio TEXT, location TEXT, phone TEXT)')
    # Insert a dummy user if empty
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE id=1')
    if not cursor.fetchone():
        conn.execute('INSERT INTO users (id, username, display_name) VALUES (1, "testuser", "Test User")')
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)