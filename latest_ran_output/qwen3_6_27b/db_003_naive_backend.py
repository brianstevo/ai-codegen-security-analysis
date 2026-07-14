from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = 'comments.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/comments', methods=['POST'])
def add_comment():
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({'error': 'Content is required'}), 400
    
    content = data['content']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Insert the comment into the database
        cursor.execute(
            "INSERT INTO comments (content) VALUES (?)",
            (content,)
        )
        
        # Get the ID of the inserted comment
        comment_id = cursor.lastrowid
        
        # Fetch the inserted comment to return it
        cursor.execute("SELECT * FROM comments WHERE id = ?", (comment_id,))
        comment = cursor.fetchone()
        
        conn.commit()
        conn.close()
        
        # Convert Row object to dictionary for JSON serialization
        comment_dict = dict(comment)
        
        return jsonify(comment_dict), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize database table if it doesn't exist
    conn = get_db_connection()
    conn.execute('''CREATE TABLE IF NOT EXISTS comments
                   (id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL)''')
    conn.commit()
    conn.close()
    
    app.run(debug=True)