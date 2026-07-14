from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/search', methods=['GET'])
def search_products():
    keyword = request.args.get('keyword')
    if not keyword:
        return jsonify({'error': 'Missing keyword'}), 400

    conn = sqlite3.connect('products.db')
    cursor = conn.cursor()
    query = "SELECT * FROM products WHERE name LIKE ?"
    cursor.execute(query, ('%' + keyword + '%',))
    results = cursor.fetchall()

    conn.close()

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)