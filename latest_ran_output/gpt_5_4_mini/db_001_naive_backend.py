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

    if not keyword:
        return jsonify({"error": "keyword is required"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT id, name, description, price FROM products WHERE name LIKE ? OR description LIKE ?",
            (f"%{keyword}%", f"%{keyword}%"),
        )
        products = [dict(row) for row in cursor.fetchall()]
        return jsonify({"products": products}), 200
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)