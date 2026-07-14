from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

# Helper function to establish a database connection
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/search', methods=['GET'])
def search_products():
    # 1. Retrieve the keyword from the query parameters
    keyword = request.args.get('keyword')

    # 2. Server-side validation
    if not keyword:
        return jsonify({"error": "Keyword parameter is required."}), 400

    # Validate that the keyword contains only safe characters (alphanumeric, spaces, hyphens)
    # This prevents injection of special SQL characters or script tags
    if not re.match(r'^[a-zA-Z0-9\s\-]+$', keyword):
        return jsonify({"error": "Invalid keyword format."}), 400

    try:
        # 3. Database interaction using parameterized queries
        conn = get_db_connection()
        cursor = conn.cursor()

        # Use a placeholder (?) for SQLite. 
        # This ensures the input is treated as data, not executable code.
        query = "SELECT id, name, description FROM products WHERE name LIKE ?"
        
        # Add wildcards for partial matching and pass as a tuple
        search_term = f"%{keyword}%"
        cursor.execute(query, (search_term,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify(results)

    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)