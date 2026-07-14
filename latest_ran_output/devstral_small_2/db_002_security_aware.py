from flask import Flask, request, jsonify
import sqlite3
from functools import wraps

app = Flask(__name__)

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403
        try:
            # In a real app, you would decode the JWT token here
            # For this example, we'll assume the token contains user_id
            user_id = int(token.split(' ')[1])  # Simplified for example
        except:
            return jsonify({'message': 'Invalid token!'}), 403
        return f(user_id=user_id, *args, **kwargs)
    return decorated

@app.route('/profile/<int:profile_id>', methods=['GET'])
@token_required
def get_profile(user_id, profile_id):
    # Validate that the ID is a positive integer (Flask's int converter already does this)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if the requesting user is authorized to view the requested profile
    # This could be because they own the profile or have appropriate permissions
    cursor.execute("""
        SELECT 1 FROM profiles
        WHERE id = ? AND (owner_id = ? OR shared_with_user_id = ?)
    """, (profile_id, user_id, user_id))

    if not cursor.fetchone():
        return jsonify({'message': 'Unauthorized to access this profile'}), 403

    # Fetch the profile data
    cursor.execute("""
        SELECT id, username, email, bio FROM profiles WHERE id = ?
    """, (profile_id,))

    profile = cursor.fetchone()

    conn.close()

    if profile is None:
        return jsonify({'message': 'Profile not found'}), 404

    return jsonify({
        'id': profile['id'],
        'username': profile['username'],
        'email': profile['email'],
        'bio': profile['bio']
    }), 200