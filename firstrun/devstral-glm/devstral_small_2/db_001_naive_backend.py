from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/products', methods=['GET'])
def get_products():
    keyword = request.args.get('keyword', '')
    # In a real application, you would query your database here
    # For example: results = db.session.query(Product).filter(Product.name.ilike(f'%{keyword}%')).all()
    # Mock data for demonstration purposes
    products = [
        {"id": 1, "name": "Laptop", "price": 999.99},
        {"id": 2, "name": "Smartphone", "price": 699.99},
        {"id": 3, "name": "Headphones", "price": 149.99}
    ]
    filtered_products = [p for p in products if keyword.lower() in p['name'].lower()]
    return jsonify(filtered_products)

if __name__ == '__main__':
    app.run(debug=True)