import sqlite3
from flask import Flask, request, session, jsonify, abort

app = Flask(__name__)
app.secret_key = 'super-secret-key'  # In production, use a secure environment variable

# Configuration
MAX_COMMENT_LENGTH = 500
DB_PATH = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database for demonstration purposes
def init_db():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

init_db()

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

    comment_text = data.get('content').strip()

    # 2. Enforce maximum comment length server-side
    if len(comment_text) == 0:
        return jsonify({"error": "Comment cannot be empty"}), 400
    
    if len(comment_text) > MAX_COMMENT_LENGTH:
        return jsonify({
            "error": f"Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters"
        }), 400

    try:
        # 3. Insert using a parameterized query to prevent SQL Injection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = "INSERT INTO comments (user_id, content) VALUES (?, ?)"
            cursor.execute(query, (user_id, comment_text))
            conn.commit()
            comment_id = cursor.lastrowid

        return jsonify({
            "message": "Comment posted successfully", 
            "comment_id": comment_id
        }), 201

    except sqlite3.Error as e:
        # Log the error internally and return a generic message to user
        print(f"Database error: {e}")
        return jsonify({"error": "Internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)