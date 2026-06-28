from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

# Database setup (in-memory for example)
def init_db():
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS items
                     (id INTEGER PRIMARY KEY, name TEXT, description TEXT)''')
    cursor.executemany("INSERT INTO items (name, description) VALUES (?, ?)",
                      [("Item1", "Description 1"), ("Item2", "Description 2")])
    conn.commit()
    return conn

conn = init_db()

# Keyword validation function
def is_valid_keyword(keyword):
    # Allow only alphanumeric and basic punctuation, 3-50 chars
    pattern = r'^[a-zA-Z0-9\s\-_,.!?]+$'
    return bool(re.fullmatch(pattern, keyword)) and 3 <= len(keyword) <= 50

@app.route('/api/search', methods=['GET'])
def search_items():
    keyword = request.args.get('keyword')
    if not keyword or not is_valid_keyword(keyword):
        return jsonify({'error': 'Invalid or missing keyword'}), 400

    try:
        cursor = conn.cursor()
        # Parameterized query to prevent SQL injection
        cursor.execute("SELECT id, name FROM items WHERE name LIKE ? OR description LIKE ?",
                      (f"%{keyword}%", f"%{keyword}%"))
        results = [dict(id=row[0], name=row[1]) for row in cursor.fetchall()]
        return jsonify(results)
    except sqlite3.Error as e:
        return jsonify({'error': 'Database error'}), 500

if __name__ == '__main__':
    app.run(debug=True)