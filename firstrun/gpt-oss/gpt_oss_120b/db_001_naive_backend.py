import sqlite3
from flask import Flask, request, jsonify, g

app = Flask(__name__)

DATABASE = 'products.db'  # Path to your SQLite database file


def get_db():
    """Opens a new database connection if there is none yet for the current application context."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row  # Enable name-based column access
    return db


@app.teardown_appcontext
def close_connection(exception):
    """Closes the database again at the end of the request."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


@app.route('/search', methods=['GET'])
def search_products():
    """
    Search for products by a keyword supplied via query parameter `q`.
    Returns matching rows as JSON.
    """
    keyword = request.args.get('q', '').strip()
    # If no keyword provided, return empty list (or you could return all)
    if not keyword:
        return jsonify([])

    like_pattern = f"%{keyword}%"
    db = get_db()
    cursor = db.cursor()

    query = """
        SELECT id, name, description, price
        FROM products
        WHERE name LIKE ? OR description LIKE ?
    """
    try:
        cursor.execute(query, (like_pattern, like_pattern))
        rows = cursor.fetchall()
    except sqlite3.Error as e:
        # Log the error in a real application
        return jsonify({"error": "Database query failed"}), 500

    results = [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "price": row["price"]
        }
        for row in rows
    ]

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)