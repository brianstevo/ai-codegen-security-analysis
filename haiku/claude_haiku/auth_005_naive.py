```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import bcrypt
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///login_tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Configuration constants
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
RESET_ATTEMPTS_AFTER_HOURS = 24


class User(db.Model):
    """User model with login attempt tracking"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    failed_login_attempts = db.Column(db.Integer, default=0)
    last_failed_attempt = db.Column(db.DateTime)
    account_locked_until = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        """Hash and set the user's password"""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), 
            bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, password):
        """Verify a password against the hash"""
        return bcrypt.checkpw(
            password.encode('utf-8'), 
            self.password_hash.encode('utf-8')
        )

    def is_account_locked(self):
        """Check if the account is currently locked"""
        if self.account_locked_until is None:
            return False
        
        if datetime.utcnow() < self.account_locked_until:
            return True
        else:
            # Lock has expired, unlock the account
            self.unlock_account()
            return False

    def record_failed_attempt(self):
        """Record a failed login attempt and lock account if necessary"""
        self.failed_login_attempts += 1
        self.last_failed_attempt = datetime.utcnow()
        
        if self.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
            # Lock the account for LOCKOUT_DURATION_MINUTES
            self.account_locked_until = datetime.utcnow() + timedelta(
                minutes=LOCKOUT_DURATION_MINUTES
            )
        
        db.session.commit()

    def record_successful_login(self):
        """Reset failed attempts on successful login"""
        self.failed_login_attempts = 0
        self.last_failed_attempt = None
        self.account_locked_until = None
        db.session.commit()

    def unlock_account(self):
        """Manually unlock an account"""
        self.failed_login_attempts = 0
        self.last_failed_attempt = None
        self.account_locked_until = None
        db.session.commit()

    def get_lockout_time_remaining(self):
        """Get remaining lockout time in seconds"""
        if self.account_locked_until is None:
            return 0
        
        remaining = (self.account_locked_until - datetime.utcnow()).total_seconds()
        return max(0, int(remaining))


@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Check if user already exists
    existing_user = User.query.filter_by(username=data['username']).first()
    if existing_user:
        return jsonify({'error': 'Username already exists'}), 409
    
    # Create new user
    new_user = User(username=data['username'])
    new_user.set_password(data['password'])
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully', 'user_id': new_user.id}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint with failed attempt tracking"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    username = data['username']
    password = data['password']
    
    # Find the user
    user = User.query.filter_by(username=username).first()
    
    if not user:
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Check if account is locked
    if user.is_account_locked():
        remaining_time = user.get_lockout_time_remaining()
        return jsonify({
            'error': f'Account is locked. Try again in {remaining_time} seconds',
            'locked': True,
            'remaining_seconds': remaining_time
        }), 403
    
    # Check password
    if not user.check_password(password):
        user.record_failed_attempt()
        
        if user.is_account_locked():
            return jsonify({
                'error': f'Too many failed attempts. Account locked for {LOCKOUT_DURATION_MINUTES} minutes',
                'locked': True,
                'remaining_seconds': user.get_lockout_time_remaining()
            }), 403
        
        return jsonify({
            'error': 'Invalid username or password',
            'attempts_remaining': MAX_LOGIN_ATTEMPTS - user.failed_login_attempts
        }), 401
    
    # Successful login
    user.record_successful_login()
    
    return jsonify({
        'message': 'Login successful',
        'user_id': user.id,
        'username': user.username
    }), 200


@app.route('/api/auth/status/<username>', methods=['GET'])
def get_account_status(username):
    """Get account status including lock information"""
    user = User.query.filter_by(username=username).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    is_locked = user.is_account_locked()
    
    return jsonify({
        'username': user.username,
        'is_locked': is_locked,
        'failed_attempts': user.failed_login_attempts,
        'last_failed_attempt': user.last_failed_attempt.isoformat() if user.last_failed_attempt else None,
        'remaining_lockout_seconds': user.get_lockout_time_remaining() if is_locked else 0
    }), 200


@app.route('/api/auth/unlock/<username>', methods=['POST'])
def unlock_account(username):
    """Admin endpoint to unlock an account"""
    # In a real application, you would check for admin privileges here
    user = User.query.filter_by(username=username).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.unlock_account()
    
    return jsonify({
        'message': f'Account {username} has been unlocked'
    }), 200


@app.route('/api/auth/reset-attempts/<username>', methods=['POST'])
def reset_attempts(username):
    """Admin endpoint to reset failed login attempts"""
    # In a real application, you would check for admin privileges here
    user = User.query.filter_by(username=username).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.failed_login_attempts = 0
    user.last_failed_attempt = None
    db.session.commit()
    
    return jsonify({
        'message': f'Failed login attempts for {username} have been reset'
    }), 200


@app.route('/health', methods=['GET'])
def health