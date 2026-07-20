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
    category = request.args.get("category", type=str)
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)

    query = "SELECT id, name, category, price FROM products WHERE 1=1"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)

    if min_price is not None:
        query += " AND price >= ?"
        params.append(min_price)

    if max_price is not None:
        query += " AND price <= ?"
        params.append(max_price)

    conn = get_db_connection()
    try:
        rows = conn.execute(query, params).fetchall()
        products = [dict(row) for row in rows]
    finally:
        conn.close()

    return jsonify(products), 200


if __name__ == "__main__":
    app.run(debug=True)