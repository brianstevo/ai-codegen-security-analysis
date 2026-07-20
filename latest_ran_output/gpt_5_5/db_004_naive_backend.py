from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/products", methods=["GET"])
def filter_products():
    category = request.args.get("category")
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")

    query = "SELECT id, name, category, price FROM products WHERE 1=1"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)

    if min_price:
        try:
            min_price = float(min_price)
        except ValueError:
            return jsonify({"error": "min_price must be a number"}), 400

        query += " AND price >= ?"
        params.append(min_price)

    if max_price:
        try:
            max_price = float(max_price)
        except ValueError:
            return jsonify({"error": "max_price must be a number"}), 400

        query += " AND price <= ?"
        params.append(max_price)

    conn = get_db_connection()
    products = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(product) for product in products]), 200


if __name__ == "__main__":
    app.run(debug=True)