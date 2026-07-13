```python
from flask import Flask, request, jsonify
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# In-memory storage for failed attempts and lockouts
# In production, use a database like Redis or PostgreSQL
failed_attempts = {}
account_lockouts = {}

MAX_FAILED_ATTEMPTS = 5
INITIAL_LOCKOUT_DURATION = 15  # minutes
ATTEMPT_RESET_WINDOW = 15  # minutes - reset counter if no attempt for this duration


def get_client_identifier():
    """Get a unique identifier for the client (IP address in this case)."""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr


def check_and_update_failed_attempts(username):
    """
    Check if account is locked and update failed attempts.
    Returns (is_locked, remaining_lockout_seconds, exponential_multiplier)
    """
    client_id = get_client_identifier()
    current_time = datetime.utcnow()
    
    # Check if account is locked
    lockout_key = f"{username}:{client_id}"
    if lockout_key in account_lockouts:
        lockout_info = account_lockouts[lockout_key]
        lockout_end = lockout_info['end_time']
        
        if current_time < lockout_end:
            remaining_seconds = int((lockout_end - current_time).total_seconds())
            return True, remaining_seconds, lockout_info['multiplier']
        else:
            # Lockout period has expired
            del account_lockouts[lockout_key]
    
    return False, 0, 1


def record_failed_attempt(username):
    """Record a failed login attempt and check if lockout should be triggered."""
    client_id = get_client_identifier()
    attempt_key = f"{username}:{client_id}"
    current_time = datetime.utcnow()
    
    # Initialize or update failed attempts
    if attempt_key not in failed_attempts:
        failed_attempts[attempt_key] = {
            'count': 1,
            'first_attempt': current_time,
            'last_attempt': current_time
        }
    else:
        attempt_info = failed_attempts[attempt_key]
        time_since_first = (current_time - attempt_info['first_attempt']).total_seconds()
        
        # Reset counter if outside the window
        if time_since_first > ATTEMPT_RESET_WINDOW * 60:
            failed_attempts[attempt_key] = {
                'count': 1,
                'first_attempt': current_time,
                'last_attempt': current_time
            }
        else:
            attempt_info['count'] += 1
            attempt_info['last_attempt'] = current_time
    
    # Check if lockout should be triggered
    if failed_attempts[attempt_key]['count'] >= MAX_FAILED_ATTEMPTS:
        # Calculate exponential backoff multiplier based on lockout history
        lockout_key = f"{username}:{client_id}"
        multiplier = 1
        
        if lockout_key in account_lockouts:
            multiplier = account_lockouts[lockout_key].get('multiplier', 1) * 2
        
        lockout_duration = INITIAL_LOCKOUT_DURATION * multiplier
        lockout_end = current_time + timedelta(minutes=lockout_duration)
        
        # Store lockout information
        account_lockouts[lockout_key] = {
            'end_time': lockout_end,
            'multiplier': multiplier,
            'triggered_at': current_time
        }
        
        # Clear failed attempts for this account
        del failed_attempts[attempt_key]
        
        return True, int(lockout_duration * 60), multiplier
    
    return False, 0, 1


def clear_failed_attempts(username):
    """Clear failed attempts for a successful login."""
    client_id = get_client_identifier()
    attempt_key = f"{username}:{client_id}"
    
    if attempt_key in failed_attempts:
        del failed_attempts[attempt_key]


@app.route('/login', methods=['POST'])
def login():
    """
    Login endpoint with account lockout protection.
    Returns generic error messages to avoid revealing lockout status to attackers.
    """
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    username = data['username']
    password = data['password']
    
    # Check if account is locked
    is_locked, remaining_seconds, multiplier = check_and_update_failed_attempts(username)
    
    if is_locked:
        # Return generic error - don't reveal lockout status
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Perform authentication (simplified - in production use proper password hashing)
    # This is a mock authentication - replace with real implementation
    valid_credentials = authenticate_user(username, password)
    
    if not valid_credentials:
        # Record failed attempt
        lockout_triggered, lockout_duration, multiplier = record_failed_attempt(username)
        
        # Return generic error regardless of lockout status
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Successful login - clear failed attempts
    clear_failed_attempts(username)
    
    return jsonify({
        'success': True,
        'message': 'Login successful',
        'token': 'mock-jwt-token-here'
    }), 200


def authenticate_user(username, password):
    """
    Mock authentication function.
    In production, validate against hashed passwords in database.
    """
    # This is a simplified mock - in production use bcrypt or similar
    mock_users = {
        'testuser': 'password123',
        'admin': 'secure_password'
    }
    
    if username in mock_users:
        return mock_users[username] == password
    
    return False


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200


@app.route('/admin/reset-lockout', methods=['POST'])
def reset_lockout():
    """
    Admin endpoint to reset account lockout.
    In production, protect this with proper authentication and authorization.
    """
    data = request.get_json()
    
    if not data or 'username' not in data:
        return jsonify({'error': 'Missing username'}), 400
    
    username = data['username']
    client_id = get_client_identifier()
    
    # Reset both failed attempts and lockout
    attempt_key = f"{username}:{client_id}"
    lockout_key = f"{username}:{client_id}"
    
    if attempt_key in failed_attempts:
        del failed_attempts[attempt_key]
    
    if lockout_key in account_lockouts:
        del account_lockouts[lockout_key]
    
    return jsonify({
        'success': True,
        'message': f'Lockout reset for user {username}'
    }), 200


@app.route('/admin/status', methods=['GET'])
def admin_status():
    """
    Admin endpoint to check current lockout status.
    In production, protect this with proper authentication and authorization.
    """
    username = request.args.get('username')
    
    if not username:
        return jsonify({'error': 'Missing username parameter'}), 400
    
    client_id = get_client_identifier()
    lockout_key = f"{username}:{client_id}"
    attempt_key = f"{username}:{client_id}"
    
    is_locked = lockout_key in account_lockouts
    failed_count = 0
    lockout_info = None
    
    if attempt_key in failed_attempts:
        failed_count = failed