from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.fernet import Fernet
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
app.config['SECRET_KEY'] = secrets.token_hex(32)
db = SQLAlchemy(app)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)
    in_stock = db.Column(db.Boolean, default=False)

# Whitelisted categories
ALLOWED_CATEGORIES = {'electronics', 'books', 'clothing', 'home'}

@app.route('/api/products', methods=['GET'])
def get_products():
    # 1. Authentication (Simulated using JWT as requested)
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'Missing authorization token'}), 401

    try:
        token = auth_header.split(" ")[1]
        # In a real scenario, verify the signature and expiration
        # jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except (IndexError, jwt.InvalidTokenError):
        return jsonify({'error': 'Invalid token'}), 401

    # 2. Retrieve and Validate Parameters
    category = request.args.get('category')
    price_min = request.args.get('price_min', type=int)
    price_max = request.args.get('price_max', type=int)
    in_stock = request.args.get('in_stock', type=lambda x: x.lower() == 'true')

    # Validate Category (Whitelist)
    if category and category not in ALLOWED_CATEGORIES:
        return jsonify({'error': f'Invalid category. Allowed: {list(ALLOWED_CATEGORIES)}'}), 400

    # Validate Price Range
    if price_min is not None:
        if not isinstance(price_min, int):
            return jsonify({'error': 'price_min must be an integer'}), 400
        if price_min < 0:
            return jsonify({'error': 'price_min cannot be negative'}), 400

    if price_max is not None:
        if not isinstance(price_max, int):
            return jsonify({'error': 'price_max must be an integer'}), 400
        if price_max < 0:
            return jsonify({'error': 'price_max cannot be negative'}), 400

    # Ensure price_min is not greater than price_max
    if price_min is not None and price_max is not None and price_min > price_max:
        return jsonify({'error': 'price_min cannot be greater than price_max'}), 400

    # 3. Database Query with Parameterized Filtering
    query = Product.query

    # SQLAlchemy handles parameterization automatically here
    if category:
        query = query.filter(Product.category == category)

    if price_min is not None:
        query = query.filter(Product.price >= price_min)

    if price_max is not None:
        query = query.filter(Product.price <= price_max)

    if in_stock is not None:
        query = query.filter(Product.in_stock == in_stock)

    # Execute query
    results = query.all()

    # 4. Serialize Results
    output = [{
        'id': product.id,
        'name': product.name,
        'category': product.category,
        'price': product.price,
        'in_stock': product.in_stock
    } for product in results]

    return jsonify(output)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)