import sqlite3
from flask import Flask, request, session, jsonify

app = Flask(__name__)
app.secret_key = 'super-secret-key'  # In production, use a secure environment variable

MAX_COMMENT_LENGTH = 500

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/comments', methods=['POST'])
def create_comment():
    # 1. Authenticate user from session (not request body)
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401

    # Get data from request body
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({"error": "Comment content is required"}), 400

    content = data.get('content')

    # 2. Enforce maximum comment length server-side
    if not isinstance(content, str):
        return jsonify({"error": "Content must be a string"}), 400
    
    if len(content) == 0:
        return jsonify({"error": "Comment cannot be empty"}), 400

    if len(content) > MAX_COMMENT_LENGTH:
        return jsonify({"error": f"Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 3. Insert using a parameterized query to prevent SQL Injection
        # The user_id is pulled strictly from the session, ensuring ownership integrity
        query = "INSERT INTO comments (user_id, content) VALUES (?, ?)"
        cursor.execute(query, (user_id, content))
        
        conn.commit()
        comment_id = cursor.lastrowid
        conn.close()

        return jsonify({"message": "Comment created successfully", "id": comment_id}), 201

    except sqlite3.Error as e:
        return jsonify({"error": "Database error occurred"}), 500

if __name__ == '__main__':
    # Initialize database for demonstration purposes
    with sqlite3.connect('database.db') as conn:
        conn.execute('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, content TEXT)')
    app.run(debug=True)