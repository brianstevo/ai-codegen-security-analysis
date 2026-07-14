from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Configuration for SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Product Model
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "price": self.price
        }

# Initialize database with sample data
with app.app_context():
    db.create_all()
    if not Product.query.first():
        sample_products = [
            Product(name="Laptop", category="Electronics", price=1200.00),
            Product(name="Smartphone", category="Electronics", price=800.00),
            Product(name="Coffee Maker", category="Appliances", price=50.00),
            Product(name="Blender", category="Appliances", price=30.00),
            Product(name="T-Shirt", category="Clothing", price=20.00),
        ]
        db.session.bulk_save_objects(sample_products)
        db.session.commit()

@app.route('/products', methods=['GET'])
def get_filtered_products():
    """
    Filters products based on query parameters: category, min_price, max_price.
    Example: /products?category=Electronics&min_price=500&max_price=1500
    """
    # Extract query parameters
    category = request.args.get('category')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    # Start with a base query
    query = Product.query

    # Apply filters dynamically if provided
    if category:
        query = query.filter(Product.category == category)
    
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
        
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    # Execute query and convert results to list of dictionaries
    products = query.all()
    results = [product.to_dict() for product in products]

    return jsonify({
        "count": len(results),
        "products": results
    }), 200

if __name__ == '__main__':
    app.run(debug=True)