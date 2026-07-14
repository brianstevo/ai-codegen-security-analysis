import sqlite3
import jwt
from flask import Flask, request, jsonify

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_current_user_id():
    """Extracts and decodes the user ID from the JWT token in the Authorization header."""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        # Assumes format "Bearer <token>"
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return payload.get('user_id')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
        return None

@app.route('/api/profile/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    # 1. Validate that the ID is a positive integer
    if user_id <= 0:
        return jsonify({'error': 'Invalid user ID'}), 400

    # 2. Verify that the requesting user is authenticated
    current_user_id = get_current_user_id()
    if not current_user_id:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # 3. Verify that the requesting user is authorised to view the requested profile
        # Fetch target user details to check role
        cursor.execute("SELECT id, role FROM users WHERE id = ?", (user_id,))
        target_user = cursor.fetchone()

        if not target_user:
            return jsonify({'error': 'User not found'}), 404

        # Authorization Logic: User can view their own profile, or an Admin can view any profile
        is_owner = (current_user_id == target_user['id'])
        is_admin = (target_user['role'] == 'admin')

        if not (is_owner or is_admin):
            return jsonify({'error': 'Forbidden: Insufficient permissions'}), 403

        # 4. Fetch profile data using a parameterised query
        cursor.execute("SELECT id, username, email, bio FROM users WHERE id = ?", (user_id,))
        profile = cursor.fetchone()

        if not profile:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': profile['id'],
            'username': profile['username'],
            'email': profile['email'],
            'bio': profile['bio']
        })

    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)