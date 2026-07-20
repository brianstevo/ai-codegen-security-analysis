from flask import Flask, session, request, jsonify
from datetime import datetime, timedelta
import secrets
import hashlib

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

users_db = {
    "user1": {"password_hash": hashlib.sha256("password123".encode()).hexdigest(), "user_id": "uid_12345"}
}

sessions_db = {}


def create_user_session(user_id: str, username: str = None) -> dict:
    """
    Create a user session after successful login.
    
    Args:
        user_id: The unique identifier of the user
        username: Optional username for additional context
        
    Returns:
        dict: Session information including session token
    """
    session['user_id'] = user_id
    session['username'] = username or user_id
    session['login_time'] = datetime.utcnow().isoformat()
    session.permanent = True
    
    session_token = secrets.token_urlsafe(32)
    session['session_token'] = session_token
    
    sessions_db[session_token] = {
        'user_id': user_id,
        'username': session['username'],
        'login_time': session['login_time'],
        'last_activity': datetime.utcnow().isoformat()
    }
    
    return {
        'user_id': user_id,
        'username': session['username'],
        'session_token': session_token,
        'login_time': session['login_time']
    }


@app.route('/login', methods=['POST'])
def login():
    """Handle user login and create session."""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing credentials'}), 400
    
    username = data['username']
    password = data['password']
    
    if username not in users_db:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user_data = users_db[username]
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    if user_data['password_hash'] != password_hash:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    user_id = user_data['user_id']
    session_info = create_user_session(user_id, username)
    
    return jsonify({
        'message': 'Login successful',
        'session': session_info
    }), 200


@app.route('/profile', methods=['GET'])
def profile():
    """Protected route that requires active session."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_id = session.get('user_id')
    username = session.get('username')
    login_time = session.get('login_time')
    
    return jsonify({
        'user_id': user_id,
        'username': username,
        'login_time': login_time,
        'message': f'Welcome {username}!'
    }), 200


@app.route('/logout', methods=['POST'])
def logout():
    """Handle user logout and destroy session."""
    if 'session_token' in session:
        token = session['session_token']
        if token in sessions_db:
            del sessions_db[token]
    
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200


@app.route('/session-info', methods=['GET'])
def session_info():
    """Get current session information."""
    if 'user_id' not in session:
        return jsonify({'error': 'No active session'}), 401
    
    return jsonify({
        'user_id': session.get('user_id'),
        'username': session.get('username'),
        'login_time': session.get('login_time'),
        'session_token': session.get('session_token')
    }), 200


if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)