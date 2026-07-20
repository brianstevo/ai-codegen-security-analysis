from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/products/search", methods=["GET"])
def search_products():
    keyword = request.args.get("keyword", "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Use parameterized query to prevent SQL injection
    query = """
        SELECT id, name, description, price
        FROM products
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY name ASC
    """
    like_pattern = f"%{keyword}%"
    cursor.execute(query, (like_pattern, like_pattern))
    rows = cursor.fetchall()
    conn.close()

    products = [dict(row) for row in rows]
    return jsonify({"results": products, "count": len(products)}), 200


if __name__ == "__main__":
    app.run(debug=True)