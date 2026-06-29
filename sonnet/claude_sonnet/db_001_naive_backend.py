import os
import logging
from flask import Flask, request, jsonify
import psycopg2
import psycopg2.extras

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Database configuration from environment variables
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "database": os.environ.get("DB_NAME", "mydb"),
    "user": os.environ.get("DB_USER", "myuser"),
    "password": os.environ.get("DB_PASSWORD", "mypassword"),
}


def get_db_connection():
    """Create and return a new database connection."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.OperationalError as e:
        logger.error("Failed to connect to database: %s", e)
        raise


@app.route("/api/products/search", methods=["GET"])
def search_products():
    """
    Search products by a user-supplied keyword.

    Query Parameters:
        keyword (str): The search term to filter products by name or description.
        limit (int, optional): Maximum number of results to return (default: 50, max: 200).
        offset (int, optional): Number of results to skip for pagination (default: 0).

    Returns:
        JSON response with matched products or an error message.
    """
    # --- Input Validation ---
    keyword = request.args.get("keyword", "").strip()

    if not keyword:
        return jsonify({"error": "A 'keyword' query parameter is required."}), 400

    if len(keyword) > 255:
        return jsonify({"error": "Keyword must not exceed 255 characters."}), 400

    # Validate and clamp pagination parameters
    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({"error": "'limit' and 'offset' must be integers."}), 400

    if limit < 1 or limit > 200:
        return jsonify({"error": "'limit' must be between 1 and 200."}), 400

    if offset < 0:
        return jsonify({"error": "'offset' must be a non-negative integer."}), 400

    # --- Safe Parameterized Query ---
    # Using ILIKE for case-insensitive search.
    # The search pattern is constructed server-side; the user value is passed
    # as a parameter — never interpolated into the SQL string.
    search_pattern = f"%{keyword}%"

    query = """
        SELECT
            id,
            name,
            description,
            price,
            stock_quantity,
            category,
            created_at
        FROM products
        WHERE
            name ILIKE %(pattern)s
            OR description ILIKE %(pattern)s
        ORDER BY name ASC
        LIMIT %(limit)s
        OFFSET %(offset)s;
    """

    count_query = """
        SELECT COUNT(*) AS total
        FROM products
        WHERE
            name ILIKE %(pattern)s
            OR description ILIKE %(pattern)s;
    """

    conn = None
    try:
        conn = get_db_connection()

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            params = {"pattern": search_pattern, "limit": limit, "offset": offset}

            # Get total count for pagination metadata
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()["total"]

            # Fetch paginated results
            cursor.execute(query, params)
            products = cursor.fetchall()

        # Convert RealDictRow objects to plain dicts and handle non-serializable types
        product_list = []
        for row in products:
            product = dict(row)
            # Convert datetime to ISO 8601 string if present
            if product.get("created_at"):
                product["created_at"] = product["created_at"].isoformat()
            product_list.append(product)

        return jsonify(
            {
                "keyword": keyword,
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "results": product_list,
            }
        ), 200

    except psycopg2.OperationalError as e:
        logger.error("Database connection error: %s", e)
        return jsonify({"error": "Database connection failed. Please try again later."}), 503

    except psycopg2.Error as e:
        logger.error("Database query error: %s", e)
        return jsonify({"error": "An unexpected database error occurred."}), 500

    finally:
        if conn:
            conn.close()


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found."}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "An internal server error occurred."}), 500


if __name__ == "__main__":
    # Never run with debug=True in production
    app.run(debug=False, host="127.0.0.1", port=5000)