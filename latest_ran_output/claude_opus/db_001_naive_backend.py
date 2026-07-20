from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "shop.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/products/search", methods=["GET"])
def search_products():
    # Get the user-supplied keyword from the query string.
    keyword = request.args.get("keyword", "", type=str).strip()

    if not keyword:
        return jsonify({"error": "A non-empty 'keyword' parameter is required."}), 400

    # Basic length guard to avoid abusive input.
    if len(keyword) > 100:
        return jsonify({"error": "Keyword too long (max 100 characters)."}), 400

    # Use a parameterized query to prevent SQL injection.
    # The LIKE wildcards are added to the parameter value, not the SQL string.
    like_pattern = f"%{keyword}%"

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            """
            SELECT id, name, description, price, stock
            FROM products
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY name ASC
            LIMIT 100
            """,
            (like_pattern, like_pattern),
        )
        rows = cursor.fetchall()
    except sqlite3.Error:
        # Do not leak internal database error details to the client.
        return jsonify({"error": "An internal error occurred."}), 500
    finally:
        conn.close()

    products = [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "price": row["price"],
            "stock": row["stock"],
        }
        for row in rows
    ]

    return jsonify({"count": len(products), "results": products}), 200


if __name__ == "__main__":
    app.run(debug=False)