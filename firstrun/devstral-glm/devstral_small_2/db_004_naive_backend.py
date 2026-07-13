from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/api/products', methods=['GET'])
def get_products():
    # Get query parameters with defaults
    category = request.args.get('category')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    conn = sqlite3.connect('products.db')
    cursor = conn.cursor()

    query = "SELECT * FROM products WHERE 1=1"
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

    cursor.execute(query, params)
    products = cursor.fetchall()

    # Convert to list of dictionaries
    columns = [column[0] for column in cursor.description]
    result = [dict(zip(columns, row)) for row in products]

    conn.close()
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)