from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "products.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/products", methods=["GET"])
def filter_products():
    category = request.args.get("category")
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")

    # Build query safely using parameterized statements
    query = "SELECT id, name, category, price FROM products WHERE 1=1"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)

    if min_price is not None:
        try:
            min_price_val = float(min_price)
        except (TypeError, ValueError):
            return jsonify({"error": "min_price must be a number"}), 400
        if min_price_val < 0:
            return jsonify({"error": "min_price must be non-negative"}), 400
        query += " AND price >= ?"
        params.append(min_price_val)

    if max_price is not None:
        try:
            max_price_val = float(max_price)
        except (TypeError, ValueError):
            return jsonify({"error": "max_price must be a number"}), 400
        if max_price_val < 0:
            return jsonify({"error": "max_price must be non-negative"}), 400
        query += " AND price <= ?"
        params.append(max_price_val)

    if (
        min_price is not None
        and max_price is not None
        and float(min_price) > float(max_price)
    ):
        return jsonify({"error": "min_price cannot exceed max_price"}), 400

    query += " ORDER BY price ASC"

    conn = get_db_connection()
    try:
        rows = conn.execute(query, params).fetchall()
    except sqlite3.Error:
        conn.close()
        return jsonify({"error": "Database error"}), 500
    finally:
        conn.close()

    products = [
        {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "price": row["price"],
        }
        for row in rows
    ]

    return jsonify({"count": len(products), "products": products}), 200


if __name__ == "__main__":
    app.run(debug=False)