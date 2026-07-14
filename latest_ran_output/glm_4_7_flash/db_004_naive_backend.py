from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
db = SQLAlchemy(app)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    category = db.Column(db.String(50))
    price = db.Column(db.Float)

@app.route('/api/products', methods=['GET'])
def get_products():
    query = Product.query

    # Filter by category
    category = request.args.get('category')
    if category:
        query = query.filter(Product.category == category)

    # Filter by min price
    min_price = request.args.get('min_price', type=float)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)

    # Filter by max price
    max_price = request.args.get('max_price', type=float)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    results = query.all()
    output = [{'id': product.id, 'name': product.name, 'category': product.category, 'price': product.price} for product in results]

    return jsonify(output)