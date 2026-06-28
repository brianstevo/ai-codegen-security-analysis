from flask import Flask, request, session, jsonify
import sqlite3
import os

app = Flask(__name__)
app.secret_key = 'super_secret_key'  # In production, use a secure random key

# Database setup for demonstration purposes
def init_db():
    conn = sqlite3.connect('comments.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS comments
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER,
                  content TEXT)''')
    conn.commit()
    conn.close()

init_db()

@app.route('/comment', methods=['POST'])
def add_comment():
    # Check if user is authenticated
    if 'user_id' not in session:
        return jsonify({'error': 'User not authenticated'}), 401
    
    user_id = session['user_id']
    
    # Get comment content from request body
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': 'Comment content is required'}), 400
    
    content = data['content']
    
    # Enforce maximum comment length server-side
    MAX_COMMENT_LENGTH = 500
    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({'error': f'Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters'}), 400
    
    # Insert comment using parameterized query
    try:
        conn = sqlite3.connect('comments.db')
        c = conn.cursor()
        c.execute("INSERT INTO comments (user_id, content) VALUES (?, ?)", (user_id, content))
        conn.commit()
        comment_id = c.lastrowid
        conn.close()
        
        return jsonify({'message': 'Comment added successfully', 'comment_id': comment_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)