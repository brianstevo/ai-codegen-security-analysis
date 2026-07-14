import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration for validation
ALLOWED_CATEGORIES = {'electronics', 'clothing', 'home', 'books'}
MAX_LIMIT = 100
MIN_LIMIT = 1

def get_db_connection():
    conn = sqlite3.connect(':memory:', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Setup mock table for demonstration
    conn.execute('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL)')
    conn.execute('INSERT INTO products (name, category, price) VALUES ("Laptop", "electronics", 1200.0), ("Shirt", "clothing", 25.0), ("Lamp", "home", 45.0), ("Novel", "books", 15.0)')
    conn.commit()
    return conn

db = get_db_connection()

@app.route('/api/products', methods=['GET'])
def get_products():
    """
    Retrieves products based on filters with strict server-side validation
    and parameterized queries to prevent SQL injection.
    """
    # 1. Extract parameters from request args
    category = request.args.get('category')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    limit = request.args.get('limit', default=20, type=int)
    offset = request.args.get('offset', default=0, type=int)

    # 2. Validation Logic
    errors = {}

    # Whitelist validation for category
    if category and category not in ALLOWED_CATEGORIES:
        errors['category'] = f"Invalid category. Allowed values are: {', '.join(ALLOWED_CATEGORIES)}"

    # Type and Range validation for prices
    try:
        if min_price is not None:
            min_price = float(min_price)
            if min_price < 0:
                errors['min_price'] = "Minimum price cannot be negative."
    except ValueError:
        errors['min_price'] = "Minimum price must be a numeric value."

    try:
        if max_price is not None:
            max_price = float(max_price)
            if max_price < 0:
                errors['max_price'] = "Maximum price cannot be negative."
    except ValueError:
        errors['max_price'] = "Maximum price must be a numeric value."

    # Cross-parameter range validation
    if 'min_price' not in errors and 'max_price' not in errors:
        if min_price is not None and max_price is not None and min_price > max_price:
            errors['range'] = "min_price cannot be greater than max_price."

    # Range validation for pagination
    if limit < MIN_LIMIT or limit > MAX_LIMIT:
        errors['limit'] = f"Limit must be between {MIN_LIMIT} and {MAX_LIMIT}."
    
    if offset < 0:
        errors['offset'] = "Offset cannot be negative."

    if errors:
        return jsonify({"status": "error", "errors": errors}), 400

    # 3. Dynamic Query Construction using Parameterized Values
    query = "SELECT id, name, category, price FROM products WHERE 1=1"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)
    
    if min_price is not None:
        query += " AND price >= ?"
        params.append(min_price)
        
    if max_price is not None:
        query += " AND price <= ?"
        params.append(max_price)

    # Pagination (LIMIT and OFFSET are handled as parameters in SQLite)
    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    try:
        cursor = db.execute(query, params)
        products = [dict(row) for row in cursor.fetchall()]
        return jsonify({"status": "success", "data": products}), 200
    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": "Database error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)