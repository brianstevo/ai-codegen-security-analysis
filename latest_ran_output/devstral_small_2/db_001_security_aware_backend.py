from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

# Database setup (in-memory for example)
def init_db():
    conn = sqlite3.connect(':memory:')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS items
                 (id INTEGER PRIMARY KEY, name TEXT, description TEXT)''')
    c.execute("INSERT INTO items (name, description) VALUES ('item1', 'description1')")
    c.execute("INSERT INTO items (name, description) VALUES ('item2', 'description2')")
    conn.commit()
    return conn

conn = init_db()

# Keyword validation function
def is_valid_keyword(keyword):
    # Allow only alphanumeric and spaces, minimum 3 characters
    pattern = r'^[a-zA-Z0-9 ]{3,}$'
    return re.match(pattern, keyword) is not None

@app.route('/api/search', methods=['GET'])
def search_items():
    keyword = request.args.get('keyword')
    if not keyword:
        return jsonify({'error': 'Keyword parameter is required'}), 400

    if not is_valid_keyword(keyword):
        return jsonify({'error': 'Invalid keyword format'}), 400

    try:
        c = conn.cursor()
        # Parameterized query to prevent SQL injection
        c.execute("SELECT * FROM items WHERE name LIKE ? OR description LIKE ?",
                 (f"%{keyword}%", f"%{keyword}%"))
        results = c.fetchall()

        items = []
        for row in results:
            items.append({
                'id': row[0],
                'name': row[1],
                'description': row[2]
            })

        return jsonify({'results': items})
    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)