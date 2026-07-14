import sqlite3
from flask import Flask, request, jsonify
from functools import wraps
import jwt
import bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key'

# Database helper to ensure parameterized queries
def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

# Mock authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            # Expecting "Bearer <token>"
            token_str = token.split(" ")[1]
            data = jwt.decode(token_str, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['user_id']
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Whitelist of fields that are allowed to be updated by the user
UPDATABLE_FIELDS = {
    'first_name': {'type': str, 'min_len': 2, 'max_len': 50},
    'last_name': {'type': str, 'min_len': 2, 'max_len': 50},
    'bio': {'type': str, 'max_len': 250},
    'phone': {'type': str, 'max_len': 20}
}

def validate_input(data):
    """Validates input against the whitelist and specific constraints."""
    validated_data = {}
    for field, constraints in UPDATABLE_FIELDS.items():
        if field in data:
            val = data[field]
            # Type check
            if not isinstance(val, constraints['type']):
                return None, f"Invalid type for {field}. Expected {constraints['type'].__name__}."
            
            # Length checks
            if 'min_len' in constraints and len(str(val)) < constraints['min_len']:
                return None, f"{field} is too short."
            if 'max_len' in constraints and len(str(val)) > constraints['max_len']:
                return None, f"{field} exceeds maximum length."
            
            validated_data[field] = val
    return validated_data, None

@app.route('/profile/<int:user_id>', methods=['PUT'])
@token_required
def update_profile(current_user, user_id):
    # 1. Authorization: Ensure the authenticated user can only update their own profile
    if current_user != user_id:
        return jsonify({'message': 'Unauthorized to update this profile'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    # 2. Validation & Mass Assignment Prevention (Whitelist)
    # Only fields in UPDATABLE_FIELDS will be extracted and validated
    validated_data, error = validate_input(data)
    if error:
        return jsonify({'message': error}), 400
    
    if not validated_data:
        return jsonify({'message': 'No valid updatable fields provided'}), 400

    # 3. Parameterized Query Construction
    # Dynamically build the SET clause based on the whitelist to avoid hardcoding and mass assignment
    fields_to_update = [f"{key} = ?" for key in validated_data.keys()]
    query = f"UPDATE users SET {', '.join(fields_to_update)} WHERE id = ?"
    
    # Values list: values from the whitelist + the user_id for the WHERE clause
    params = list(validated_data.values()) + [user_id]

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'User not found'}), 404
            
        conn.close()
        return jsonify({'message': 'Profile updated successfully'}), 200
    except sqlite3.Error as e:
        return jsonify({'message': f'Database error: {str(e)}'}), 500

if __name__ == '__main__':
    # Initialize DB for demonstration purposes
    conn = sqlite3.connect('users.db')
    conn.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, bio TEXT, phone TEXT)')
    conn.execute('INSERT OR IGNORE INTO users (id, first_name) VALUES (1, "John Doe")')
    conn.commit()
    conn.close()
    app.run(debug=True)