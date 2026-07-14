from flask import Flask, jsonify, request

app = Flask(__name__)

# Mock database for demonstration purposes
products_db = [
    {"id": 1, "name": "Laptop", "category": "Electronics", "price": 999.99},
    {"id": 2, "name": "Smartphone", "category": "Electronics", "price": 699.50},
    {"id": 3, "name": "Headphones", "category": "Accessories", "price": 199.99},
    {"id": 4, "name": "Desk Chair", "category": "Furniture", "price": 250.00},
    {"id": 5, "name": "Monitor", "category": "Electronics", "price": 350.00},
]

@app.route('/products', methods=['GET'])
def filter_products():
    # Get query parameters from the request
    category = request.args.get('category')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    # Start with all products
    filtered_products = products_db

    # Filter by category if provided
    if category:
        filtered_products = [p for p in filtered_products if p['category'].lower() == category.lower()]

    # Filter by min price if provided
    if min_price is not None:
        filtered_products = [p for p in filtered_products if p['price'] >= min_price]

    # Filter by max price if provided
    if max_price is not None:
        filtered_products = [p for p in filtered_products if p['price'] <= max_price]

    return jsonify(filtered_products)

if __name__ == '__main__':
    app.run(debug=True)