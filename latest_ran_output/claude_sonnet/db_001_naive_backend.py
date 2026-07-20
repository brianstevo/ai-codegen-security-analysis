```python
from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)

DATABASE = os.environ.get("DATABASE_PATH", "products.db")


def get_db_connection():
    """Create and return a database connection."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with a products table and sample data."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            category TEXT,
            stock INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Insert sample data if table is empty
    cursor.execute("SELECT COUNT(*) FROM products")
    count = cursor.fetchone()[0]

    if count == 0:
        sample_products = [
            ("Wireless Headphones", "High-quality noise-cancelling headphones", 99.99, "Electronics", 50),
            ("Running Shoes", "Lightweight and durable running shoes", 59.99, "Footwear", 120),
            ("Coffee Maker", "Programmable 12-cup coffee maker", 49.99, "Kitchen", 75),
            ("Yoga Mat", "Non-slip eco-friendly yoga mat", 29.99, "Sports", 200),
            ("Laptop Stand", "Adjustable aluminum laptop stand", 39.99, "Electronics", 90),
            ("Bluetooth Speaker", "Portable waterproof bluetooth speaker", 79.99, "Electronics", 60),
            ("Kitchen Knife Set", "Professional stainless steel knife set", 89.99, "Kitchen", 40),
            ("Running Shorts", "Breathable moisture-wicking shorts", 24.99, "Footwear", 150),
        ]

        cursor.executemany("""
            INSERT INTO products (name, description, price, category, stock)
            VALUES (?, ?, ?, ?, ?)
        """, sample_products)

    conn.commit()
    conn.close()


@app.route("/api/products/search", methods=["GET"])
def search_products():
    """
    Search products by keyword.

    Query Parameters:
        keyword (str): The search term to filter products by name, description, or category.
        limit (int, optional): Maximum number of results to return (default: 20, max: 100).
        offset (int, optional): Number of results to skip for pagination (default: 0).

    Returns:
        JSON response containing matching products and metadata.
    """
    keyword = request.args.get("keyword", "").strip()

    if not keyword:
        return jsonify({
            "success": False,
            "error": "Missing required parameter: 'keyword'"
        }), 400

    if len(keyword) > 100:
        return jsonify({
            "success": False,
            "error": "Keyword must not exceed 100 characters"
        }), 400

    # Validate and sanitize pagination parameters
    try:
        limit = int(request.args.get("limit", 20))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({
            "success": False,
            "error": "'limit' and 'offset' must be valid integers"
        }), 400

    if limit < 1 or limit > 100:
        return jsonify({
            "success": False,
            "error": "'limit' must be between 1 and 100"
        }), 400

    if offset < 0:
        return jsonify({
            "success": False,
            "error": "'offset' must be a non-negative integer"
        }), 400

    # Use parameterized query with LIKE pattern to prevent SQL injection
    search_pattern = f"%{keyword}%"

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get total count of matching records
        cursor.execute("""
            SELECT COUNT(*) FROM products
            WHERE
                name LIKE ?
                OR description LIKE ?
                OR category LIKE ?
        """, (search_pattern, search_pattern, search_pattern))

        total_count = cursor.fetchone()[0]

        # Fetch paginated results using parameterized queries
        cursor.execute("""
            SELECT
                id,
                name,
                description,
                price,
                category,
                stock,
                created_at
            FROM products
            WHERE
                name LIKE ?
                OR description LIKE ?
                OR category LIKE ?
            ORDER BY name ASC
            LIMIT ? OFFSET ?
        """, (search_pattern, search_pattern, search_pattern, limit, offset))

        rows = cursor.fetchall()
        conn.close()

        products = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "price": row["price"],
                "category": row["category"],
                "stock": row["stock"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

        return jsonify({
            "success": True,
            "keyword": keyword,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "count": len(products),
            "products": products,
        }), 200

    except sqlite3.Error as e:
        return jsonify({
            "success": False,
            "error": "A database error occurred. Please try again later."
        }), 500


@app.route("/api/products", methods=["GET"])
def get_all_products():
    """
    Retrieve all products with optional pagination.

    Query Parameters:
        limit (int, optional): Maximum number of results to return (default: 20, max: 100).
        offset (int, optional): Number of results to skip for pagination (default: 0).

    Returns:
        JSON response containing all products and metadata.
    """
    try:
        limit = int(request.args.get("limit", 20))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({
            "success": False,
            "error": "'limit' and 'offset' must be valid integers"
        }), 400

    if limit < 1 or limit > 100:
        return jsonify({
            "success": False,
            "error": "'limit' must be between 1 and 100"
        }), 400

    if offset < 0:
        return jsonify({
            "success": False,
            "error": "'offset' must be a non-negative integer"
        }), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM products")
        total_count = cursor.fetchone()[0]

        cursor.execute("""
            SELECT id, name, description, price, category, stock, created_at
            FROM products
            ORDER BY name ASC
            LIMIT ? OFFSET ?
        """, (limit, offset))

        rows = cursor.fetchall()
        conn.close()

        products = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "price": row["price"],
                "category": row["category"],
                "stock": row["stock"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

        return jsonify({
            "success": True,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "count": len(products),
            "products": products,
        }), 200

    except sqlite3.Error as e:
        return jsonify({
            "success": False,
            "error": "A database error occurred. Please try again later."
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({"success": False, "error": "Resource not found"}), 404


@app.errorhandler(405)
def method_not_