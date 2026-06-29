```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from functools import wraps
import sqlite3
import os

app = Flask(__name__)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Whitelisted categories
ALLOWED_CATEGORIES = ['electronics', 'clothing', 'books', 'home', 'sports']

# Filter parameter validation rules
FILTER_RULES = {
    'price_min': {'type': (int, float), 'min': 0, 'max': 1000000},
    'price_max': {'type': (int, float), 'min': 0, 'max': 1000000},
    'category': {'type': str, 'allowed': ALLOWED_CATEGORIES},
    'rating_min': {'type': (int, float), 'min': 0, 'max': 5},
    'stock_min': {'type': int, 'min': 0, 'max': 1000000},
    'discount_percentage': {'type': (int, float), 'min': 0, 'max': 100},
    'page': {'type': int, 'min': 1, 'max': 10000},
    'limit': {'type': int, 'min': 1, 'max': 100},
    'search': {'type': str, 'max_length': 100},
}

def validate_filters(f):
    """Decorator to validate filter parameters before processing"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        errors = {}
        validated_filters = {}
        
        # Get all filter parameters from request
        filters = request.args.to_dict()
        
        for param_name, param_value in filters.items():
            if param_name not in FILTER_RULES:
                errors[param_name] = f"Unknown filter parameter: {param_name}"
                continue
            
            rule = FILTER_RULES[param_name]
            
            # Validate type
            expected_type = rule.get('type')
            if expected_type and not isinstance(param_value, expected_type):
                try:
                    if isinstance(expected_type, tuple):
                        # Try to convert to the first type in tuple
                        param_value = expected_type[0](param_value)
                    else:
                        param_value = expected_type(param_value)
                except (ValueError, TypeError):
                    errors[param_name] = f"Invalid type for {param_name}, expected {expected_type.__name__}"
                    continue
            
            # Validate range
            if 'min' in rule:
                if param_value < rule['min']:
                    errors[param_name] = f"{param_name} must be >= {rule['min']}"
                    continue
            
            if 'max' in rule:
                if param_value > rule['max']:
                    errors[param_name] = f"{param_name} must be <= {rule['max']}"
                    continue
            
            # Validate allowed values
            if 'allowed' in rule:
                if param_value not in rule['allowed']:
                    errors[param_name] = f"{param_name} must be one of {rule['allowed']}"
                    continue
            
            # Validate string length
            if 'max_length' in rule:
                if isinstance(param_value, str) and len(param_value) > rule['max_length']:
                    errors[param_name] = f"{param_name} must be <= {rule['max_length']} characters"
                    continue
            
            validated_filters[param_name] = param_value
        
        if errors:
            return jsonify({'error': 'Validation failed', 'details': errors}), 400
        
        # Pass validated filters to the route
        kwargs['filters'] = validated_filters
        return f(*args, **kwargs)
    
    return decorated_function

# Create a simple Product model for demonstration
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)
    rating = db.Column(db.Float, default=0)
    stock = db.Column(db.Integer, default=0)
    discount_percentage = db.Column(db.Float, default=0)
    description = db.Column(db.Text)

@app.route('/api/products', methods=['GET'])
@validate_filters
def get_products(filters):
    """Get products with validated filter parameters using parameterized queries"""
    
    # Build the base query with parameterized values
    query = "SELECT id, name, category, price, rating, stock, discount_percentage FROM products WHERE 1=1"
    params = {}
    param_counter = 0
    
    # Add filters with parameterized queries
    if 'search' in filters:
        param_counter += 1
        query += f" AND (name LIKE :param{param_counter} OR description LIKE :param{param_counter})"
        params[f'param{param_counter}'] = f"%{filters['search']}%"
    
    if 'category' in filters:
        param_counter += 1
        # Category is already validated against whitelist
        query += f" AND category = :param{param_counter}"
        params[f'param{param_counter}'] = filters['category']
    
    if 'price_min' in filters:
        param_counter += 1
        query += f" AND price >= :param{param_counter}"
        params[f'param{param_counter}'] = filters['price_min']
    
    if 'price_max' in filters:
        param_counter += 1
        query += f" AND price <= :param{param_counter}"
        params[f'param{param_counter}'] = filters['price_max']
    
    if 'rating_min' in filters:
        param_counter += 1
        query += f" AND rating >= :param{param_counter}"
        params[f'param{param_counter}'] = filters['rating_min']
    
    if 'stock_min' in filters:
        param_counter += 1
        query += f" AND stock >= :param{param_counter}"
        params[f'param{param_counter}'] = filters['stock_min']
    
    if 'discount_percentage' in filters:
        param_counter += 1
        query += f" AND discount_percentage >= :param{param_counter}"
        params[f'param{param_counter}'] = filters['discount_percentage']
    
    # Add pagination
    page = int(filters.get('page', 1))
    limit = int(filters.get('limit', 20))
    offset = (page - 1) * limit
    
    param_counter += 1
    query += f" LIMIT :param{param_counter}"
    params[f'param{param_counter}'] = limit
    
    param_counter += 1
    query += f" OFFSET :param{param_counter}"
    params[f'param{param_counter}'] = offset
    
    # Execute the parameterized query
    try:
        result = db.session.execute(text(query), params)
        products = []
        for row in result:
            products.append({
                'id': row[0],
                'name': row[1],
                'category': row[2],
                'price': row[3],
                'rating': row[4],
                'stock': row[5],
                'discount_percentage': row[6]
            })
        
        return jsonify({
            'status': 'success',
            'data': products,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': len(products)
            },
            'filters_applied': filters
        }), 200
    except Exception as e:
        return jsonify({'error': 'Database query failed', 'message': str(e)}