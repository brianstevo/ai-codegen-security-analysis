import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    
    # Lockout tracking fields
    failed_attempts = db.Column(db.Integer, default=0)
    lockout_until = db.Column(db.DateTime, nullable=True)
    lockout_count = db.Column(db.Integer, default=0)  # Tracks number of times locked out for exponential back-off

with app.app_context():
    db.create_all()

def calculate_lockout_duration(lockout_count):
    """
    Implements exponential back-off. 
    Initial lockout: 15 minutes. Subsequent lockouts double the duration.
    """
    base_minutes = 15
    return timedelta(minutes=base_minutes * (2 ** lockout_count))

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Invalid credentials"}), 401

    user = User.query.filter_by(username=username).first()

    # Generic error message to prevent account enumeration and reveal lockout status
    generic_error = {"error": "Invalid username or password"}

    if not user:
        return jsonify(generic_error), 401

    now = datetime.utcnow()

    # Check if the account is currently locked
    if user.lockout_until and now < user.lockout_until:
        # We return the generic error even though we know it's a lockout
        return jsonify(generic_error), 401

    # Verify password
    if check_password_hash(user.password_hash, password):
        # Success: Reset all security counters
        user.failed_attempts = 0
        user.lockout_until = None
        user.lockout_count = 0
        db.session.commit()
        return jsonify({"message": "Login successful"}), 200
    else:
        # Failure: Increment failed attempts
        user.failed_attempts += 1
        
        if user.failed_attempts >= 5:
            # Calculate duration based on how many times they've been locked out previously
            duration = calculate_lockout_duration(user.lockout_count)
            user.lockout_until = now + duration
            
            # Increment lockout count for the next time they hit the threshold
            user.lockout_count += 1
            # Reset failed attempts so they start from 0 after the current lockout expires
            user.failed_attempts = 0
        
        db.session.commit()
        return jsonify(generic_error), 401

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "User already exists"}), 400
        
    hashed_pw = generate_password_hash(password)
    new_user = User(username=username, password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created"}), 201

if __name__ == '__main__':
    app.run(debug=True)