from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# Initialize database (in-memory for this example)
def init_db():
    conn = sqlite3.connect('comments.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS comments
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT)''')
    conn.commit()
    conn.close()

@app.route('/api/comments', methods=['POST'])
def add_comment():
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': 'Content is required'}), 400

    content = data['content']

    conn = sqlite3.connect('comments.db')
    c = conn.cursor()
    c.execute("INSERT INTO comments (content) VALUES (?)", (content,))
    comment_id = c.lastrowid
    conn.commit()

    # Fetch the inserted comment to return it
    c.execute("SELECT * FROM comments WHERE id = ?", (comment_id,))
    comment = c.fetchone()
    conn.close()

    return jsonify({
        'id': comment[0],
        'content': comment[1]
    }), 201

if __name__ == '__main__':
    init_db()
    app.run(debug=True)