from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)

# Database configuration
database_url = os.environ.get('DATABASE_URL', 'sqlite:///products.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Product model
class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'price': self.price,
            'stock': self.stock,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

@app.route('/products', methods=['GET'])
def filter_products():
    try:
        # Get filter parameters from request
        category = request.args.get('category', type=str)
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        # Validate limit and offset
        limit = min(limit, 500)  # Max 500 results per request
        if limit < 1:
            limit = 1
        if offset < 0:
            offset = 0
        
        # Build query
        query = Product.query
        
        # Apply filters
        if category:
            query = query.filter_by(category=category.strip())
        
        if min_price is not None:
            query = query.filter(Product.price >= min_price)
        
        if max_price is not None:
            query = query.filter(Product.price <= max_price)
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        products = query.limit(limit).offset(offset).all()
        
        # Return results
        return jsonify({
            'success': True,
            'data': [product.to_dict() for product in products],
            'pagination': {
                'total': total_count,
                'limit': limit,
                'offset': offset,
                'returned': len(products)
            }
        }), 200
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid parameter value',
            'message': str(e)
        }), 400
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/products', methods=['POST'])
def create_product():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'name' not in data or 'category' not in data or 'price' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'message': 'name, category, and price are required'
            }), 400
        
        # Create new product
        product = Product(
            name=data['name'],
            description=data.get('description', ''),
            category=data['category'],
            price=float(data['price']),
            stock=data.get('stock', 0)
        )
        
        db.session.add(product)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': product.to_dict(),
            'message': 'Product created successfully'
        }), 201
    
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Invalid data type',
            'message': str(e)
        }), 400
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'Product Filter API'
    }), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Not found',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': 'Method not allowed',
        'message': 'The HTTP method is not allowed for this endpoint'
    }), 405

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Add sample data if products table is empty
        if Product.query.count() == 0:
            sample_products = [
                Product(name='Laptop', category='Electronics', price=999.99, stock=10),
                Product(name='Mouse', category='Electronics', price=29.99, stock=50),
                Product(name='Keyboard', category='Electronics', price=79.99, stock=30),
                Product(name='Monitor', category='Electronics', price=299.99, stock=15),
                Product(name='Desk Chair', category='Furniture', price=199.99, stock=8),
                Product(name='Standing Desk', category='Furniture', price=449.99, stock=5),
                Product(name='Office Lamp', category='Furniture', price=49.99, stock=20),
                Product(name='USB Cable', category='Electronics', price=9.99, stock=100),
                Product(name='Headphones', category='Electronics', price=149.99, stock=25),
                Product(name='Webcam', category='Electronics', price=89.99, stock=12),
            ]
            db.session.add_all(sample_products)
            db.session.commit()
    
    app.run(debug=True, host='0.0.0.0', port=5000)