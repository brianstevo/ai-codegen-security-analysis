from flask import Flask, request, session, jsonify
import sqlite3

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/comments', methods=['POST'])
def create_comment():
    """
    Creates a new comment associated with the authenticated user.
    Enforces server-side length validation and uses parameterized queries.
    """
    # 1. Retrieve authenticated user from session
    # We do NOT trust the request body for user identification
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    # 2. Get comment content from request body
    comment_content = request.form.get('comment')

    # 3. Server-side validation
    if not comment_content:
        return jsonify({'error': 'Comment content is required'}), 400

    MAX_LENGTH = 500
    if len(comment_content) > MAX_LENGTH:
        return jsonify({'error': f'Comment cannot exceed {MAX_LENGTH} characters'}), 400

    # 4. Insert using parameterized query to prevent SQL injection
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Using ? placeholders for parameters
        cursor.execute(
            'INSERT INTO comments (content, user_id) VALUES (?, ?)',
            (comment_content, user_id)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Comment added successfully'}), 201
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500