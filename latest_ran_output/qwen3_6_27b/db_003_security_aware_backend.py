from flask import Flask, request, jsonify, session
import sqlite3

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# Helper function to get a database connection
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/comments', methods=['POST'])
def add_comment():
    # Check if user is authenticated
    if 'user_id' not in session:
        return jsonify({'error': 'User must be logged in'}), 401
    
    data = request.get_json()
    
    # Validate that comment text is provided
    if 'text' not in data or not data['text']:
        return jsonify({'error': 'Comment text is required'}), 400
    
    comment_text = data['text']
    
    # Enforce maximum comment length server-side (e.g., 500 characters)
    MAX_COMMENT_LENGTH = 500
    if len(comment_text) > MAX_COMMENT_LENGTH:
        return jsonify({'error': f'Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters'}), 400
    
    # Get user_id from session, not from request body
    user_id = session['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        cursor.execute(
            'INSERT INTO comments (user_id, text) VALUES (?, ?)',
            (user_id, comment_text)
        )
        
        conn.commit()
        comment_id = cursor.lastrowid
        
        return jsonify({
            'message': 'Comment added successfully',
            'comment_id': comment_id,
            'user_id': user_id,
            'text': comment_text
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Failed to add comment: {str(e)}'}), 500
        
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)