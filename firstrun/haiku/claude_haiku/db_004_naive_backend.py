from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

# Configure SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///products.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Product model
class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'price': self.price,
            'description': self.description
        }

@app.route('/api/products', methods=['GET'])
def filter_products():
    """
    Filter products by category, min_price, and max_price.
    Query parameters:
    - category: (optional) Filter by product category
    - min_price: (optional) Minimum price filter
    - max_price: (optional) Maximum price filter
    """
    try:
        # Get query parameters
        category = request.args.get('category', type=str)
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        
        # Start with base query
        query = Product.query
        
        # Apply category filter if provided
        if category:
            query = query.filter(Product.category.ilike(f'%{category}%'))
        
        # Apply minimum price filter if provided
        if min_price is not None:
            query = query.filter(Product.price >= min_price)
        
        # Apply maximum price filter if provided
        if max_price is not None:
            query = query.filter(Product.price <= max_price)
        
        # Execute query and get results
        products = query.all()
        
        # Convert products to dictionary format
        results = [product.to_dict() for product in products]
        
        return jsonify({
            'success': True,
            'count': len(results),
            'data': results
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/products', methods=['POST'])
def create_product():
    """Create a new product."""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or not all(k in data for k in ('name', 'category', 'price')):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: name, category, price'
            }), 400
        
        # Create new product
        product = Product(
            name=data['name'],
            category=data['category'],
            price=float(data['price']),
            description=data.get('description', '')
        )
        
        db.session.add(product)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': product.to_dict()
        }), 201
        
    except ValueError:
        return jsonify({
            'success': False,
            'error': 'Invalid price value'
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Get a specific product by ID."""
    try:
        product = Product.query.get(product_id)
        
        if not product:
            return jsonify({
                'success': False,
                'error': 'Product not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': product.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

# Create tables and seed sample data
def init_db():
    with app.app_context():
        db.create_all()
        
        # Check if products already exist
        if Product.query.first() is None:
            # Sample products
            sample_products = [
                Product(name='Laptop', category='Electronics', price=999.99, description='High-performance laptop'),
                Product(name='Mouse', category='Electronics', price=29.99, description='Wireless mouse'),
                Product(name='Desk Chair', category='Furniture', price=199.99, description='Ergonomic office chair'),
                Product(name='Coffee Maker', category='Appliances', price=79.99, description='Automatic coffee maker'),
                Product(name='Headphones', category='Electronics', price=149.99, description='Noise-cancelling headphones'),
                Product(name='Bookshelf', category='Furniture', price=89.99, description='Wooden bookshelf'),
                Product(name='Microwave', category='Appliances', price=59.99, description='Compact microwave oven'),
                Product(name='Monitor', category='Electronics', price=299.99, description='4K gaming monitor'),
                Product(name='Keyboard', category='Electronics', price=79.99, description='Mechanical gaming keyboard'),
                Product(name='Desk Lamp', category='Furniture', price=39.99, description='LED desk lamp'),
            ]
            
            for product in sample_products:
                db.session.add(product)
            
            db.session.commit()
            print('Database initialized with sample data')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)