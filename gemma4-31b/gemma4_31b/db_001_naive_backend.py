from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)

# Configuration for SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///store.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Product Model
class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": self.price
        }

# Initialize database with dummy data for demonstration
with app.app_context():
    db.create_all()
    if not Product.query.first():
        sample_products = [
            Product(name="Gaming Laptop", description="High performance laptop", price=1200.00),
            Product(name="Wireless Mouse", description="Ergonomic optical mouse", price=25.00),
            Product(name="Mechanical Keyboard", description="RGB backlit keyboard", price=80.00),
            Product(name="USB-C Hub", description="Multi-port adapter", price=45.00),
        ]
        db.session.bulk_save_objects(sample_products)
        db.session.commit()

@app.route('/api/products/search', methods=['GET'])
def search_products():
    """
    Queries the products table using a keyword provided in the query string.
    Example: /api/products/search?q=laptop
    """
    # Get the 'q' parameter from the request URL
    keyword = request.args.get('q', '')

    if not keyword:
        return jsonify({"error": "Keyword parameter 'q' is required"}), 400

    try:
        # Use SQLAlchemy ORM to perform a case-insensitive search.
        # .ilike() handles the SQL injection prevention via parameterized queries automatically.
        search_pattern = f"%{keyword}%"
        results = Product.query.filter(
            (Product.name.ilike(search_pattern)) | 
            (Product.description.ilike(search_pattern))
        ).all()

        # Convert SQLAlchemy objects to a list of dictionaries
        products_list = [product.to_dict() for product in results]

        return jsonify({
            "count": len(products_list),
            "keyword": keyword,
            "results": products_list
        }), 200

    except Exception as e:
        # Log the error internally and return a generic server error
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)