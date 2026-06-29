from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from bcrypt import hashpw, gensalt, checkpw
import os

app = Flask(__name__)

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    def set_password(self, password):
        """Hash and store the password"""
        self.password_hash = hashpw(password.encode('utf-8'), gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Check if the provided password matches the stored hash"""
        return checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

# Create tables
with app.app_context():
    db.create_all()

@app.route('/login', methods=['POST'])
def login():
    """
    Secure login endpoint that:
    - Uses parameterized queries to prevent SQL injection
    - Compares passwords with bcrypt
    - Returns generic error response regardless of username or password being wrong
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        username = data.get('username')
        password = data.get('password')
        
        # Use parameterized query (SQLAlchemy handles this automatically)
        user = User.query.filter_by(username=username).first()
        
        # Generic error response for both non-existent user and wrong password
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        return jsonify({'message': 'Login successful', 'user_id': user.id}), 200
    
    except Exception as e:
        # Log the error securely without exposing details to the client
        app.logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400
        
        username = data.get('username')
        password = data.get('password')
        
        # Check if user already exists using parameterized query
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409
        
        # Create new user
        user = User(username=username)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'User registered successfully'}), 201
    
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)