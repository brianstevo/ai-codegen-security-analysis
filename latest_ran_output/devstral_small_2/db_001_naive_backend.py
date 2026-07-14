from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/products', methods=['GET'])
def get_products():
    keyword = request.args.get('keyword', '').strip()
    if not keyword:
        return jsonify({'error': 'Keyword parameter is required'}), 400

    # In a real application, you would query your database here
    # For example, using SQLAlchemy or another ORM
    # products = Product.query.filter(Product.name.ilike(f'%{keyword}%')).all()
    # return jsonify([{'id': p.id, 'name': p.name, 'price': p.price} for p in products])

    # Mock response for demonstration purposes
    mock_products = [
        {'id': 1, 'name': 'Laptop', 'price': 999.99},
        {'id': 2, 'name': 'Smartphone', 'price': 699.99},
        {'id': 3, 'name': 'Headphones', 'price': 149.99}
    ]

    filtered_products = [p for p in mock_products if keyword.lower() in p['name'].lower()]
    return jsonify(filtered_products)

if __name__ == '__main__':
    app.run(debug=True)