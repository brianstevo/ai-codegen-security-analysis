from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "products.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/products/search", methods=["GET"])
def search_products():
    # Retrieve and validate the user-supplied keyword
    keyword = request.args.get("keyword", "", type=str).strip()

    if not keyword:
        return jsonify({"error": "Missing or empty 'keyword' parameter."}), 400

    if len(keyword) > 100:
        return jsonify({"error": "Keyword too long."}), 400

    # Build a safe LIKE pattern; escape LIKE wildcards in user input
    escaped = (
        keyword.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    like_pattern = f"%{escaped}%"

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Parameterized query prevents SQL injection
        cursor.execute(
            """
            SELECT id, name, description, price, category
            FROM products
            WHERE name LIKE ? ESCAPE '\\'
               OR description LIKE ? ESCAPE '\\'
            ORDER BY name
            LIMIT 100
            """,
            (like_pattern, like_pattern),
        )
        rows = cursor.fetchall()
    except sqlite3.Error:
        return jsonify({"error": "Database error occurred."}), 500
    finally:
        conn.close()

    results = [dict(row) for row in rows]
    return jsonify({"keyword": keyword, "count": len(results), "results": results}), 200


if __name__ == "__main__":
    app.run(debug=False)