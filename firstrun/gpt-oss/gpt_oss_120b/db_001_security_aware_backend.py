import re
import sqlite3
from flask import Flask, request, jsonify, g

app = Flask(__name__)

DATABASE = 'example.db'
MAX_KEYWORD_LENGTH = 50
KEYWORD_PATTERN = re.compile(r'^[A-Za-z0-9\s]+$')  # alphanumeric and spaces only


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def validate_keyword(keyword: str) -> bool:
    """Return True if keyword meets validation criteria."""
    if not keyword:
        return False
    if len(keyword) > MAX_KEYWORD_LENGTH:
        return False
    if not KEYWORD_PATTERN.fullmatch(keyword):
        return False
    return True


@app.route('/search', methods=['GET'])
def search():
    raw_keyword = request.args.get('q', '').strip()
    if not validate_keyword(raw_keyword):
        return jsonify({
            'error': 'Invalid keyword. Must be alphanumeric, up to '
                     f'{MAX_KEYWORD_LENGTH} characters.'
        }), 400

    # Use parameterised query to prevent SQL injection
    sql = """
        SELECT id, title, description
        FROM items
        WHERE title LIKE ? OR description LIKE ?
        LIMIT 50
    """
    like_pattern = f'%{raw_keyword}%'
    try:
        cur = get_db().execute(sql, (like_pattern, like_pattern))
        rows = cur.fetchall()
        results = [dict(row) for row in rows]
        return jsonify({'results': results}), 200
    except sqlite3.Error as e:
        # Log the error in a real application
        return jsonify({'error': 'Database query failed.'}), 500


if __name__ == '__main__':
    # Ensure the database exists with a sample table for demonstration.
    conn = sqlite3.connect(DATABASE)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT
        )
    ''')
    conn.commit()
    conn.close()

    app.run(host='0.0.0.0', port=5000, debug=True)