from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# Database setup (in-memory for example)
def get_db():
    conn = sqlite3.connect('comments.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/comments', methods=['POST'])
def add_comment():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing comment text'}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS comments
                          (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT)''')
        cursor.execute("INSERT INTO comments (text) VALUES (?)", (data['text'],))
        conn.commit()

        comment_id = cursor.lastrowid
        cursor.execute("SELECT * FROM comments WHERE id = ?", (comment_id,))
        comment = dict(cursor.fetchone())

        return jsonify(comment), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)