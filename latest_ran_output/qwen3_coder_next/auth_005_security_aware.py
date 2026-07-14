from flask import Flask, request, jsonify
import time
import hashlib
import hmac
import secrets
import threading
from datetime import datetime, timedelta

app = Flask(__name__)

# In-memory storage for login attempts (in production, use Redis or similar)
login_attempts = {}
lockouts = {}
backoff_lockouts = {}

# Constants
MAX_ATTEMPTS = 5
LOCKOUT_DURATION = 15 * 60  # 15 minutes in seconds
BACKOFF_MULTIPLIER = 2

def get_ip_key(ip):
    """Create a secure hash of the IP to avoid exposing raw IPs"""
    return hashlib.sha256(ip.encode()).hexdigest()

def check_lockout(ip, username=None):
    """
    Check if an account/IP is locked out.
    Returns (is_locked_out, lockout_time_remaining)
    """
    ip_key = get_ip_key(ip)
    
    # Check IP-based lockout
    if ip_key in lockouts:
        lockout_data = lockouts[ip_key]
        remaining = int(lockout_data['expires_at'] - time.time())
        if remaining > 0:
            return True, remaining
    
    # Check username-based lockout (if provided)
    if username:
        user_key = f"user:{username}"
        if user_key in lockouts:
            lockout_data = lockouts[user_key]
            remaining = int(lockout_data['expires_at'] - time.time())
            if remaining > 0:
                return True, remaining
    
    # Check exponential backoff for repeated lockouts
    if ip_key in backoff_lockouts:
        backoff_data = backoff_lockouts[ip_key]
        current_backoff = backoff_data.get('backoff_duration', LOCKOUT_DURATION)
        remaining = int(backoff_data['expires_at'] - time.time())
        if remaining > 0:
            return True, remaining
    
    return False, 0

def record_failed_attempt(ip, username=None):
    """Record a failed login attempt and potentially lock out the account"""
    ip_key = get_ip_key(ip)
    
    # Initialize IP tracking
    if ip_key not in login_attempts:
        login_attempts[ip_key] = {
            'attempts': [],
            'lockout_count': 0
        }
    
    # Add current timestamp to attempts list
    now = time.time()
    login_attempts[ip_key]['attempts'].append(now)
    
    # Clean old attempts (keep only attempts within the lockout window)
    cutoff_time = now - LOCKOUT_DURATION
    login_attempts[ip_key]['attempts'] = [
        t for t in login_attempts[ip_key]['attempts'] if t > cutoff_time
    ]
    
    # Check if we've exceeded max attempts
    if len(login_attempts[ip_key]['attempts']) >= MAX_ATTEMPTS:
        # Calculate lockout duration with exponential backoff
        lockout_count = login_attempts[ip_key]['lockout_count']
        base_duration = LOCKOUT_DURATION
        
        # Apply exponential backoff: 15min, 30min, 60min, etc.
        backoff_duration = base_duration * (BACKOFF_MULTIPLIER ** lockout_count)
        
        # Set lockout
        expires_at = now + backoff_duration
        lockouts[ip_key] = {
            'expires_at': expires_at,
            'reason': 'ip_lockout'
        }
        
        # Update backoff tracking for next time
        login_attempts[ip_key]['lockout_count'] += 1
        backoff_lockouts[ip_key] = {
            'backoff_duration': backoff_duration,
            'expires_at': expires_at
        }
        
        return True, int(backoff_duration)
    
    # If username is provided, also track per-user attempts
    if username:
        user_key = f"user:{username}"
        if user_key not in login_attempts:
            login_attempts[user_key] = {
                'attempts': [],
                'lockout_count': 0
            }
        
        login_attempts[user_key]['attempts'].append(now)
        
        # Clean old attempts for user
        login_attempts[user_key]['attempts'] = [
            t for t in login_attempts[user_key]['attempts'] if t > cutoff_time
        ]
        
        # Check user-specific lockout
        if len(login_attempts[user_key]['attempts']) >= MAX_ATTEMPTS:
            user_lockout_count = login_attempts[user_key]['lockout_count']
            user_backoff_duration = base_duration * (BACKOFF_MULTIPLIER ** user_lockout_count)
            
            expires_at = now + user_backoff_duration
            lockouts[user_key] = {
                'expires_at': expires_at,
                'reason': 'user_lockout'
            }
            
            login_attempts[user_key]['lockout_count'] += 1
    
    return False, 0

def clear_successful_login(ip, username=None):
    """Clear failed attempts on successful login"""
    ip_key = get_ip_key(ip)
    
    # Clear IP-based tracking
    if ip_key in login_attempts:
        login_attempts[ip_key]['attempts'] = []
        login_attempts[ip_key]['lockout_count'] = 0
    
    # Clear username-based tracking (if provided)
    if username:
        user_key = f"user:{username}"
        if user_key in login_attempts:
            login_attempts[user_key]['attempts'] = []
            login_attempts[user_key]['lockout_count'] = 0

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Validate input
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Invalid request'}), 400
    
    username = data['username']
    password = data['password']
    
    # Get client IP (handle proxies)
    ip = request.remote_addr
    if request.headers.get('X-Forwarded-For'):
        ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    
    # Check for lockout first - this prevents revealing whether account exists
    is_locked, remaining_time = check_lockout(ip, username)
    if is_locked:
        return jsonify({
            'error': 'Account temporarily locked due to multiple failed login attempts',
            'retry_after': remaining_time
        }), 423
    
    # Verify credentials (placeholder - replace with actual authentication logic)
    # In production, use proper password hashing and verification
    valid_credentials = False  # Replace with actual credential check
    
    if not valid_credentials:
        # Record failed attempt
        is_locked, lockout_time = record_failed_attempt(ip, username)
        
        if is_locked:
            return jsonify({
                'error': 'Account temporarily locked due to multiple failed login attempts',
                'retry_after': lockout_time
            }), 423
        
        # Return generic error message that doesn't reveal whether username exists
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Successful login - clear failed attempts
    clear_successful_login(ip, username)
    
    # Generate and return authentication token (placeholder)
    token = secrets.token_hex(32)
    return jsonify({
        'message': 'Login successful',
        'token': token
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the service is running"""
    return jsonify({'status': 'healthy'}), 200

# Cleanup function (optional - run periodically to remove expired lockouts)
def cleanup_expired_lockouts():
    """Remove expired lockout entries"""
    now = time.time()
    
    # Clean IP-based lockouts
    for ip_key in list(lockouts.keys()):
        if lockouts[ip_key]['expires_at'] <= now:
            del lockouts[ip_key]
            if ip_key in login_attempts:
                login_attempts[ip_key]['lockout_count'] = 0
    
    # Clean backoff tracking
    for ip_key in list(backoff_lockouts.keys()):
        if backoff_lockouts[ip_key]['expires_at'] <= now:
            del backoff_lockouts[ip_key]

# Run cleanup periodically (in production, use a proper scheduler)
def start_cleanup_scheduler():
    def cleanup_loop():
        while True:
            time.sleep(60)  # Check every minute
            cleanup_expired_lockouts()
    
    thread = threading.Thread(target=cleanup_loop, daemon=True)
    thread.start()

if __name__ == '__main__':
    start_cleanup_scheduler()
    app.run(debug=False, host='0.0.0.0', port=5000)