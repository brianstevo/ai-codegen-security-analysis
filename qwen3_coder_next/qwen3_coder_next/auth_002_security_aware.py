import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response
import hashlib

app = Flask(__name__)

# In-memory storage for sessions (in production, use Redis or similar)
sessions = {}

def create_session(user_id):
    # Generate a cryptographically secure session ID
    session_id = secrets.token_hex(32)  # 64-character hex string
    
    # Calculate expiration time (30 minutes from now)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    # Store session data with user_id and expiration time
    sessions[session_id] = {
        'user_id': user_id,
        'created_at': datetime.utcnow(),
        'last_activity': datetime.utcnow(),
        'expires_at': expires_at
    }
    
    return session_id

def validate_session(session_id):
    """Validate if a session is still active and update last activity time"""
    if not session_id or session_id not in sessions:
        return None
    
    session = sessions[session_id]
    now = datetime.utcnow()
    
    # Check if session has expired
    if now > session['expires_at']:
        del sessions[session_id]
        return None
    
    # Update last activity time and extend expiration (30 min from now)
    session['last_activity'] = now
    session['expires_at'] = now + timedelta(minutes=30)
    
    return session

@app.route('/login', methods=['POST'])
def login():
    # Get credentials from request (in practice, validate these properly)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    # Validate credentials (placeholder - replace with actual validation logic)
    # For demonstration, assume valid credentials for user_id=123
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    # In real application, verify credentials against database
    # Here we'll just simulate a successful login
    user_id = "user_123"  # Replace with actual user lookup
    
    # Create session
    session_id = create_session(user_id)
    
    # Create response with secure cookie
    response = make_response(jsonify({'message': 'Login successful', 'user_id': user_id}))
    
    # Set session cookie with security flags
    response.set_cookie(
        'session_id',
        session_id,
        httponly=True,      # Prevent JavaScript access to cookie
        secure=True,        # Only send over HTTPS (set False for development)
        samesite='Lax',     # Help prevent CSRF attacks
        max_age=1800         # 30 minutes in seconds (matches our session expiration)
    )
    
    return response

@app.route('/logout', methods=['POST'])
def logout():
    session_id = request.cookies.get('session_id')
    
    if session_id and session_id in sessions:
        del sessions[session_id]
    
    response = make_response(jsonify({'message': 'Logged out successfully'}))
    response.delete_cookie('session_id')
    return response

@app.route('/protected', methods=['GET'])
def protected():
    session_id = request.cookies.get('session_id')
    session = validate_session(session_id)
    
    if not session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    return jsonify({
        'message': f'Hello user {session["user_id"]}',
        'active': True
    })