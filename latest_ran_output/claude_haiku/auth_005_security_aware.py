```python
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timedelta
import bcrypt
import secrets
from typing import Tuple, Optional

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# In-memory storage for demo - use Redis or database in production
login_attempts = {}  # username -> {'count': int, 'last_attempt': datetime, 'lockout_until': datetime, 'lockout_multiplier': int}
users = {}  # username -> {'password_hash': str, 'email': str}

class AccountLockoutManager:
    """Manages account lockout logic with exponential back-off"""
    
    BASE_LOCKOUT_MINUTES = 15
    MAX_FAILED_ATTEMPTS = 5
    EXPONENTIAL_MULTIPLIER = 2
    MAX_MULTIPLIER = 5  # Cap at 2^5 = 32x multiplier
    
    @staticmethod
    def get_attempt_record(username: str) -> dict:
        """Get or create attempt record for username"""
        if username not in login_attempts:
            login_attempts[username] = {
                'count': 0,
                'last_attempt': None,
                'lockout_until': None,
                'lockout_multiplier': 1
            }
        return login_attempts[username]
    
    @staticmethod
    def is_account_locked(username: str) -> bool:
        """Check if account is currently locked"""
        record = AccountLockoutManager.get_attempt_record(username)
        
        if record['lockout_until'] is None:
            return False
        
        now = datetime.utcnow()
        if now < record['lockout_until']:
            return True
        
        # Lockout period expired, reset the record
        record['count'] = 0
        record['lockout_until'] = None
        return False
    
    @staticmethod
    def record_failed_attempt(username: str) -> Tuple[bool, Optional[int]]:
        """
        Record a failed login attempt.
        Returns: (is_locked, remaining_seconds_until_unlock)
        """
        record = AccountLockoutManager.get_attempt_record(username)
        
        # Check if already locked
        if AccountLockoutManager.is_account_locked(username):
            remaining = (record['lockout_until'] - datetime.utcnow()).total_seconds()
            return True, max(0, int(remaining))
        
        # Increment failed attempts
        record['count'] += 1
        record['last_attempt'] = datetime.utcnow()
        
        # Check if threshold reached
        if record['count'] >= AccountLockoutManager.MAX_FAILED_ATTEMPTS:
            # Apply exponential back-off
            multiplier = min(record['lockout_multiplier'], AccountLockoutManager.MAX_MULTIPLIER)
            lockout_duration = AccountLockoutManager.BASE_LOCKOUT_MINUTES * multiplier
            
            record['lockout_until'] = datetime.utcnow() + timedelta(minutes=lockout_duration)
            record['lockout_multiplier'] = min(
                record['lockout_multiplier'] * AccountLockoutManager.EXPONENTIAL_MULTIPLIER,
                2 ** AccountLockoutManager.MAX_MULTIPLIER
            )
            
            remaining = lockout_duration * 60
            return True, remaining
        
        return False, None
    
    @staticmethod
    def record_successful_login(username: str) -> None:
        """Reset attempt counter on successful login"""
        record = AccountLockoutManager.get_attempt_record(username)
        record['count'] = 0
        record['lockout_until'] = None
        # Keep multiplier for next lockout sequence

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_user(username: str, email: str, password: str) -> bool:
    """Create a new user account"""
    if username in users:
        return False
    users[username] = {
        'password_hash': hash_password(password),
        'email': email
    }
    return True

def require_auth(f):
    """Decorator for routes that require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/register', methods=['POST'])
def register():
    """Register a new user account"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    username = data['username'].strip()
    password = data['password']
    email = data['email'].strip()
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    if create_user(username, email, password):
        return jsonify({'message': 'User created successfully'}), 201
    else:
        return jsonify({'error': 'Username already exists'}), 409

@app.route('/login', methods=['POST'])
def login():
    """
    Login endpoint with account lockout protection.
    
    Returns generic error message that doesn't reveal whether:
    - Username exists
    - Password is wrong
    - Account is locked
    
    This prevents attackers from gaining information about valid usernames.
    """
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    username = data['username'].strip()
    password = data['password']
    
    # Check if account is locked - don't reveal this to attacker
    is_locked = AccountLockoutManager.is_account_locked(username)
    
    # Check if user exists and password is correct
    user_exists = username in users
    password_correct = user_exists and verify_password(password, users[username]['password_hash'])
    
    if not user_exists or not password_correct:
        # Record failed attempt
        is_now_locked, remaining_seconds = AccountLockoutManager.record_failed_attempt(username)
        
        # Return generic error message - doesn't reveal the actual reason for failure
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if is_locked:
        # Account is locked but password is correct - still deny access with generic message
        record = AccountLockoutManager.get_attempt_record(username)
        remaining = (record['lockout_until'] - datetime.utcnow()).total_seconds()
        # Don't reveal that account is locked - generic error
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Successful login
    AccountLockoutManager.record_successful_login(username)
    
    # Generate authentication token
    token = secrets.token_urlsafe(32)
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'username': username,
        'email': users[username]['email']
    }), 200

@app.route('/protected', methods=['GET'])
@require_auth
def protected_route():
    """Example protected route that requires authentication"""
    return jsonify({'message': 'This is a protected resource'}), 200

@app.route('/status', methods=['GET'])
def status():
    """Check account lockout status (for testing/admin purposes only)"""
    username = request.args.get('username')
    
    if not username