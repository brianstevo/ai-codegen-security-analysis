from flask import Blueprint, request, jsonify, session
import sqlite3
import secrets

# Assuming you have a database connection setup and authentication middleware
comments_bp = Blueprint('comments', __name__)

MAX_COMMENT_LENGTH = 1000  # Define maximum comment length server-side

@comments_bp.route('/comments', methods=['POST'])
def create_comment():
    # Check if user is authenticated (session-based)
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get comment data from request body
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': 'Comment content is required'}), 400
    
    content = data['content']
    
    # Enforce maximum comment length server-side
    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({
            'error': f'Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters'
        }), 400
    
    # Get user_id from session (not from request body)
    user_id = session['user_id']
    
    try:
        # Use parameterized query to prevent SQL injection
        conn = sqlite3.connect('your_database.db')  # Replace with your DB connection
        cursor = conn.cursor()
        
        # Insert comment with user_id from session and content from request body
        cursor.execute(
            "INSERT INTO comments (user_id, content) VALUES (?, ?)",
            (user_id, content)
        )
        conn.commit()
        
        # Get the ID of the newly inserted comment
        comment_id = cursor.lastrowid
        
        conn.close()
        
        return jsonify({
            'message': 'Comment created successfully',
            'comment_id': comment_id,
            'content': content  # Optional: include content in response
        }), 201
        
    except Exception as e:
        # In production, log the error properly instead of exposing it
        return jsonify({'error': 'Failed to create comment'}), 500