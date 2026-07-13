```python
from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from contextlib import contextmanager
from datetime import datetime
import os
import json

app = Flask(__name__)
CORS(app)

# Database setup
DB_PATH = 'users.db'

@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """Initialize the database with sample data if it doesn't exist."""
    if not os.path.exists(DB_PATH):
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            ''')
            
            # Insert sample data
            sample_users = [
                ('john_doe', 'john@example.com', 'John Doe'),
                ('jane_smith', 'jane@example.com', 'Jane Smith'),
                ('bob_wilson', 'bob@example.com', 'Bob Wilson'),
                ('alice_johnson', 'alice@example.com', 'Alice Johnson'),
                ('charlie_brown', 'charlie@example.com', 'Charlie Brown'),
            ]
            
            for username, email, full_name in sample_users:
                cursor.execute(
                    'INSERT INTO users (username, email, full_name) VALUES (?, ?, ?)',
                    (username, email, full_name)
                )
            
            conn.commit()

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """
    Get user account data for a given user ID.
    
    Args:
        user_id: The ID of the user to retrieve
        
    Returns:
        JSON response with user data or error message
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            
            if not user:
                return jsonify({
                    'success': False,
                    'error': f'User with ID {user_id} not found'
                }), 404
            
            # Convert Row object to dictionary
            user_data = {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'full_name': user['full_name'],
                'created_at': user['created_at'],
                'updated_at': user['updated_at'],
                'is_active': bool(user['is_active'])
            }
            
            return jsonify({
                'success': True,
                'data': user_data
            }), 200
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'An error occurred while retrieving user data: {str(e)}'
        }), 500

@app.route('/api/users', methods=['GET'])
def get_all_users():
    """
    Get all users (with optional filtering).
    
    Query parameters:
        - active_only: If 'true', return only active users
        - limit: Maximum number of users to return (default: 50)
        - offset: Number of users to skip (default: 0)
        
    Returns:
        JSON response with list of users or error message
    """
    try:
        active_only = request.args.get('active_only', 'false').lower() == 'true'
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # Validate limit
        if limit > 100:
            limit = 100
        if limit < 1:
            limit = 1
        if offset < 0:
            offset = 0
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if active_only:
                cursor.execute(
                    'SELECT * FROM users WHERE is_active = 1 LIMIT ? OFFSET ?',
                    (limit, offset)
                )
            else:
                cursor.execute(
                    'SELECT * FROM users LIMIT ? OFFSET ?',
                    (limit, offset)
                )
            
            users = cursor.fetchall()
            
            # Convert to list of dictionaries
            users_list = []
            for user in users:
                users_list.append({
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'created_at': user['created_at'],
                    'updated_at': user['updated_at'],
                    'is_active': bool(user['is_active'])
                })
            
            return jsonify({
                'success': True,
                'data': users_list,
                'count': len(users_list)
            }), 200
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'An error occurred while retrieving users: {str(e)}'
        }), 500

@app.route('/api/users', methods=['POST'])
def create_user():
    """
    Create a new user.
    
    Request body:
        {
            "username": "string",
            "email": "string",
            "full_name": "string"
        }
        
    Returns:
        JSON response with created user data or error message
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'email', 'full_name']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(required_fields)}'
            }), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        full_name = data.get('full_name', '').strip()
        
        # Validate input
        if not username or not email or not full_name:
            return jsonify({
                'success': False,
                'error': 'All fields must be non-empty'
            }), 400
        
        if len(username) < 3:
            return jsonify({
                'success': False,
                'error': 'Username must be at least 3 characters long'
            }), 400
        
        if '@' not in email:
            return jsonify({
                'success': False,
                'error': 'Invalid email format'
            }), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    'INSERT INTO users (username, email, full_name) VALUES (?, ?, ?)',
                    (username, email, full_name)
                )
                user_id = cursor.lastrowid
                
                # Fetch the created user
                cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
                user = cursor.fetchone()
                
                user_data = {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'created_at': user['created_at'],
                    'updated_at': user['updated_at'],
                    'is_active': bool(user['is_active'])
                }
                
                return jsonify({