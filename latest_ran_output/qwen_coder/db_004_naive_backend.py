from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/products', methods=['GET'])
def get_products():
    category = request.args.get('category')
    min_price = float(request.args.get('min_price'))
    max_price = float(request.args.get('max_price'))

    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    query = "SELECT * FROM products WHERE category=? AND price BETWEEN ? AND ?"
    cursor.execute(query, (category, min_price, max_price))
    
    results = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    products = [dict(zip(columns, row)) for row in results]
    
    conn.close()
    
    return jsonify(products)

if __name__ == '__main__':
    app.run(debug=True)