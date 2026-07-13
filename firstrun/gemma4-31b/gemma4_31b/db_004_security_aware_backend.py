import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration for validation
ALLOWED_CATEGORIES = {'electronics', 'clothing', 'home', 'books'}
MAX_LIMIT = 100
MIN_LIMIT = 1
DEFAULT_LIMIT = 20

def get_db_connection():
    conn = sqlite3.connect(':memory:', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Setup dummy table for demonstration
    conn.execute('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL)')
    products = [
        (1, 'Laptop', 'electronics', 1200.0),
        (2, 'Phone', 'electronics', 800.0),
        (3, 'T-Shirt', 'clothing', 25.0),
        (4, 'Jeans', 'clothing', 50.0),
        (5, 'Lamp', 'home', 30.0),
        (6, 'Novel', 'books', 15.0),
    ]
    conn.executemany('INSERT INTO products VALUES (?, ?, ?, ?)', products)
    conn.commit()
    return conn

db = get_db_connection()

@app.route('/products', methods=['GET'])
def get_products():
    """
    Fetch products with validated filters:
    - category: Whitelisted strings
    - min_price/max_price: Positive floats
    - limit/offset: Positive integers within range
    """
    filters = {}
    params = []
    query = "SELECT id, name, category, price FROM products WHERE 1=1"

    try:
        # 1. Validate Category (Whitelist)
        category = request.args.get('category')
        if category:
            if category not in ALLOWED_CATEGORIES:
                return jsonify({"error": f"Invalid category. Allowed: {list(ALLOWED_CATEGORIES)}"}), 400
            query += " AND category = ?"
            params.append(category)

        # 2. Validate Price Range (Type and Bounds)
        min_price = request.args.get('min_price')
        max_price = request.args.get('max_price')

        if min_price is not None:
            try:
                val = float(min_price)
                if val < 0: raise ValueError()
                query += " AND price >= ?"
                params.append(val)
            except ValueError:
                return jsonify({"error": "min_price must be a positive number"}), 400

        if max_price is not None:
            try:
                val = float(max_price)
                if val < 0: raise ValueError()
                query += " AND price <= ?"
                params.append(val)
            except ValueError:
                return jsonify({"error": "max_price must be a positive number"}), 400

        # 3. Validate Pagination (Type and Range)
        limit_raw = request.args.get('limit', DEFAULT_LIMIT)
        offset_raw = request.args.get('offset', 0)

        try:
            limit = int(limit_raw)
            if not (MIN_LIMIT <= limit <= MAX_LIMIT):
                return jsonify({"error": f"Limit must be between {MIN_LIMIT} and {MAX_LIMIT}"}), 400
            
            offset = int(offset_raw)
            if offset < 0:
                return jsonify({"error": "Offset cannot be negative"}), 400
        except ValueError:
            return jsonify({"error": "Limit and offset must be integers"}), 400

        # Append pagination to query using parameterized values
        query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        # Execute Parameterized Query
        cursor = db.execute(query, params)
        results = [dict(row) for row in cursor.fetchall()]

        return jsonify({
            "count": len(results),
            "data": results
        }), 200

    except Exception as e:
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)