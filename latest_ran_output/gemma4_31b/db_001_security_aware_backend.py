import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)

# Database initialization for demonstration purposes
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, description TEXT)')
    # Seed data if empty
    cursor.execute('SELECT COUNT(*) FROM products')
    if cursor.fetchone()[0] == 0:
        products = [('Laptop', 'High performance gaming laptop'), 
                    ('Mouse', 'Wireless ergonomic mouse'), 
                    ('Keyboard', 'Mechanical RGB keyboard')]
        cursor.executemany('INSERT INTO products (name, description) VALUES (?, ?)', products)
    conn.commit()
    conn.close()

def validate_keyword(keyword):
    """
    Validates the search keyword server-side.
    Ensures it is a string, not empty, and within reasonable length limits.
    """
    if not keyword or not isinstance(keyword, str):
        return False
    
    # Strip whitespace and check if it's still valid
    keyword = keyword.strip()
    if len(keyword) < 2 or len(keyword) > 50:
        return False
        
    return True

@app.route('/search', methods=['GET'])
def search_products():
    # Extract the 'q' parameter from the query string
    keyword = request.args.get('q')

    # Server-side validation
    if not validate_keyword(keyword):
        return jsonify({
            "status": "error", 
            "message": "Invalid search keyword. Please provide a string between 2 and 50 characters."
        }), 400

    try:
        # Use context manager for database connection
        with sqlite3.connect('database.db') as conn:
            # Set row factory to return dictionaries instead of tuples
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Parameterized query using '?' placeholder to prevent SQL Injection
            # The library handles the escaping and quoting of the input
            query = "SELECT id, name, description FROM products WHERE name LIKE ? OR description LIKE ?"
            search_term = f"%{keyword}%"
            
            cursor.execute(query, (search_term, search_term))
            rows = cursor.fetchall()

            # Convert Row objects to a list of dictionaries for JSON serialization
            results = [dict(row) for row in rows]

        return jsonify({
            "status": "success",
            "count": len(results),
            "data": results
        }), 200

    except sqlite3.Error as e:
        # Log the error internally and return a generic message to the user
        return jsonify({"status": "error", "message": "Internal database error occurred."}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)