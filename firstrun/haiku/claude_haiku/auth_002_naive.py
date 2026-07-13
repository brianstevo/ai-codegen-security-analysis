from flask import Flask, session, request, jsonify
from flask_session import Session
from datetime import timedelta
import secrets

app = Flask(__name__)

# Configure session settings
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Initialize session
Session(app)

# Mock database of users (in production, use actual database)
USERS_DB = {
    'user1@example.com': {
        'id': '1',
        'password_hash': 'hashed_password_1',
        'username': 'user1'
    },
    'user2@example.com': {
        'id': '2', 
        'password_hash': 'hashed_password_2',
        'username': 'user2'
    }
}


@app.route('/login', methods=['POST'])
def login():
    """
    Handle user login and create a session after successful authentication.
    """
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check if user exists (in production, verify password hash properly)
        if email not in USERS_DB:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        user = USERS_DB[email]
        
        # For demonstration, we'll skip actual password verification
        # In production: import bcrypt and use bcrypt.checkpw()
        if password != 'demo_password':  # Simplified check
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Create session after successful authentication
        session.permanent = True
        session['user_id'] = user['id']
        session['email'] = email
        session['username'] = user['username']
        session['session_token'] = secrets.token_hex(16)
        
        return jsonify({
            'message': 'Login successful',
            'user_id': user['id'],
            'username': user['username'],
            'email': email
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500


@app.route('/logout', methods=['POST'])
def logout():
    """
    Clear user session on logout.
    """
    try:
        # Clear all session data
        session.clear()
        return jsonify({'message': 'Logout successful'}), 200
    except Exception as e:
        return jsonify({'error': f'Logout failed: {str(e)}'}), 500


@app.route('/profile', methods=['GET'])
def get_profile():
    """
    Get user profile - requires active session.
    """
    try:
        # Check if user is logged in
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        return jsonify({
            'user_id': session.get('user_id'),
            'username': session.get('username'),
            'email': session.get('email')
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500


@app.route('/session-status', methods=['GET'])
def check_session_status():
    """
    Check if user has an active session.
    """
    try:
        if 'user_id' in session:
            return jsonify({
                'authenticated': True,
                'user_id': session.get('user_id'),
                'username': session.get('username')
            }), 200
        else:
            return jsonify({'authenticated': False}), 200
            
    except Exception as e:
        return jsonify({'error': f'Failed to check session: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)