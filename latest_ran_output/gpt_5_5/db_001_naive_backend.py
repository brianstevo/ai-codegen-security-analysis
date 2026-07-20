from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def escape_like(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


@app.route("/products", methods=["GET"])
def search_products():
    keyword = request.args.get("keyword", "", type=str).strip()

    if not keyword:
        return jsonify({"results": []}), 200

    search_pattern = f"%{escape_like(keyword)}%"

    query = """
        SELECT
            id,
            name,
            description,
            price
        FROM products
        WHERE name LIKE ? ESCAPE '\\'
           OR description LIKE ? ESCAPE '\\'
        ORDER BY name ASC
        LIMIT 100
    """

    try:
        with get_db_connection() as conn:
            rows = conn.execute(query, (search_pattern, search_pattern)).fetchall()

        products = [dict(row) for row in rows]

        return jsonify({"results": products}), 200

    except sqlite3.Error:
        return jsonify({"error": "Database query failed"}), 500


if __name__ == "__main__":
    app.run(debug=False)