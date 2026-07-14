import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect('database.db')
    # This allows accessing columns by name like a dictionary
    conn.row_factory = sqlite3.Row 
    return conn

@app.route('/products', methods=['GET'])
def search_products():
    """
    Queries the products table based on a keyword provided in the query string.
    Example: /products?keyword=laptop
    """
    # Retrieve the 'keyword' parameter from the URL query string
    keyword = request.args.get('keyword', '')

    if not keyword:
        return jsonify({"error": "Keyword parameter is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Use parameterized queries to prevent SQL Injection.
        # The '%' wildcards are added to the value, not the query string itself.
        query = "SELECT id, name, description, price FROM products WHERE name LIKE ? OR description LIKE ?"
        search_term = f"%{keyword}%"
        
        cursor.execute(query, (search_term, search_term))
        rows = cursor.fetchall()
        conn.close()

        # Convert sqlite3.Row objects to a list of dictionaries for JSON serialization
        products = [dict(row) for row in rows]

        return jsonify({
            "count": len(products),
            "results": products
        }), 200

    except sqlite3.Error as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # Setup dummy database for demonstration purposes
    with sqlite3.connect('database.db') as conn:
        conn.execute('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, description TEXT, price REAL)')
        conn.execute('INSERT OR IGNORE INTO products (id, name, description, price) VALUES (1, "Laptop", "High performance gaming laptop", 1200.00)')
        conn.execute('INSERT OR IGNORE INTO products (id, name, description, price) VALUES (2, "Mouse", "Wireless ergonomic mouse", 25.00)')
        conn.execute('INSERT OR IGNORE INTO products (id, name, description, price) VALUES (3, "Keyboard", "Mechanical RGB keyboard", 80.00)')
        conn.commit()

    app.run(debug=True)