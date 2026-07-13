from flask import Flask, request, jsonify
import sqlite3  # Using SQLite as an example; replace with your DB driver (e.g., psycopg2, mysql-connector)

app = Flask(__name__)

# Whitelist of allowed category values
ALLOWED_CATEGORIES = ['electronics', 'clothing', 'books', 'home', 'sports']

def get_db_connection():
    """Establish a database connection."""
    conn = sqlite3.connect('example.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/products', methods=['GET'])
def filter_products():
    # Initialize parameters with defaults or None
    category = request.args.get('category')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    page = request.args.get('page')
    per_page = request.args.get('per_page')

    # --- Validation ---

    # 1. Validate Category (Whitelist)
    if category is not None:
        if category.lower() not in ALLOWED_CATEGORIES:
            return jsonify({"error": f"Invalid category. Allowed values: {ALLOWED_CATEGORIES}"}), 400
        category = category.lower()

    # 2. Validate Price Range (Type and Range)
    min_price_val = None
    max_price_val = None

    if min_price is not None:
        try:
            min_price_val = float(min_price)
            if min_price_val < 0:
                return jsonify({"error": "min_price must be non-negative"}), 400
        except ValueError:
            return jsonify({"error": "min_price must be a number"}), 400

    if max_price is not None:
        try:
            max_price_val = float(max_price)
            if max_price_val < 0:
                return jsonify({"error": "max_price must be non-negative"}), 400
        except ValueError:
            return jsonify({"error": "max_price must be a number"}), 400

    # Ensure min <= max if both are provided
    if min_price_val is not None and max_price_val is not None:
        if min_price_val > max_price_val:
            return jsonify({"error": "min_price cannot be greater than max_price"}), 400

    # 3. Validate Pagination (Type and Range)
    page_val = 1
    per_page_val = 20

    if page is not None:
        try:
            page_val = int(page)
            if page_val < 1:
                return jsonify({"error": "page must be a positive integer"}), 400
        except ValueError:
            return jsonify({"error": "page must be an integer"}), 400

    if per_page is not None:
        try:
            per_page_val = int(per_page)
            if per_page_val < 1 or per_page_val > 100:
                return jsonify({"error": "per_page must be between 1 and 100"}), 400
        except ValueError:
            return jsonify({"error": "per_page must be an integer"}), 400

    # --- Database Query with Parameterized Queries ---
    
    conn = get_db_connection()
    try:
        query = "SELECT id, name, price, category FROM products WHERE 1=1"
        params = []

        if category is not None:
            query += " AND category = ?"
            params.append(category)

        if min_price_val is not None:
            query += " AND price >= ?"
            params.append(min_price_val)

        if max_price_val is not None:
            query += " AND price <= ?"
            params.append(max_price_val)

        # Add ordering for consistent pagination
        query += " ORDER BY id ASC"

        # Calculate offset for pagination
        offset = (page_val - 1) * per_page_val
        query += " LIMIT ? OFFSET ?"
        params.append(per_page_val)
        params.append(offset)

        cursor = conn.execute(query, params)
        products = [dict(row) for row in cursor.fetchall()]

        # Optional: Get total count for pagination metadata (requires separate query or COUNT(*))
        # For simplicity, we just return the filtered list here.

        return jsonify({"products": products, "page": page_val, "per_page": per_page_val}), 200

    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)