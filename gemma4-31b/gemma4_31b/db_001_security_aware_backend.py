import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)

# Database initialization for demonstration purposes
def init_db():
    with sqlite3.connect("database.db") as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, description TEXT)")
        # Insert dummy data if table is empty
        cursor = conn.execute("SELECT count(*) FROM products")
        if cursor.fetchone()[0] == 0:
            products = [
                ('Laptop', 'High performance gaming laptop'),
                ('Smartphone', 'Latest generation mobile device'),
                ('Headphones', 'Noise cancelling over-ear headphones'),
                ('Monitor', '4K Ultra HD display')
            ]
            conn.executemany("INSERT INTO products (name, description) VALUES (?, ?)", products)
            conn.commit()

init_db()

def validate_keyword(keyword):
    """
    Validates the search keyword server-side.
    Ensures it is a string, not empty, and meets length requirements.
    """
    if not keyword or not isinstance(keyword, str):
        return False
    
    # Strip whitespace and check if it's still valid (e.g., minimum 2 characters)
    cleaned_keyword = keyword.strip()
    if len(cleaned_keyword) < 2:
        return False
        
    # Optional: Prevent excessively long queries to avoid DoS/Resource exhaustion
    if len(cleaned_keyword) > 100:
        return False
        
    return True

@app.route('/search', methods=['GET'])
def search_products():
    # Extract keyword from query parameters (?q=...)
    keyword = request.args.get('q')

    # 1. Server-side validation
    if not validate_keyword(keyword):
        return jsonify({
            "status": "error", 
            "message": "Invalid search keyword. Please provide a string of 2 to 100 characters."
        }), 400

    try:
        with sqlite3.connect("database.db") as conn:
            # Use row_factory to return results as dictionaries instead of tuples
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # 2. Parameterized query to prevent SQL Injection
            # The '?' is a placeholder that the DB driver handles safely
            query = "SELECT id, name, description FROM products WHERE name LIKE ? OR description LIKE ?"
            search_term = f"%{keyword}%"
            
            cursor.execute(query, (search_term, search_term))
            rows = cursor.fetchall()

            # Convert sqlite3.Row objects to a list of dictionaries
            results = [dict(row) for row in rows]

        # 3. Return results as JSON
        return jsonify({
            "status": "success",
            "count": len(results),
            "data": results
        }), 200

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": "Database error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)