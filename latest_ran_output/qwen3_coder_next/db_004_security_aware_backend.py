from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import re

app = Flask(__name__)

# Whitelist of allowed categories
ALLOWED_CATEGORIES = ['electronics', 'books', 'clothing', 'home', 'sports']

def validate_filter_params(params):
    """Validate filter parameters: type, range, and whitelist"""
    errors = []
    
    # Validate category (whitelist)
    if 'category' in params:
        category = params['category']
        if not isinstance(category, str) or category not in ALLOWED_CATEGORIES:
            errors.append(f"Invalid category value. Must be one of: {', '.join(ALLOWED_CATEGORIES)}")
    
    # Validate price range
    if 'min_price' in params:
        try:
            min_price = float(params['min_price'])
            if min_price < 0 or min_price > 1000000:  # Example range limit
                errors.append("min_price must be between 0 and 1,000,000")
        except (ValueError, TypeError):
            errors.append("min_price must be a number")
    
    if 'max_price' in params:
        try:
            max_price = float(params['max_price'])
            if max_price < 0 or max_price > 1000000:  # Example range limit
                errors.append("max_price must be between 0 and 1,000,000")
        except (ValueError, TypeError):
            errors.append("max_price must be a number")
    
    if 'min_price' in params and 'max_price' in params:
        try:
            min_p = float(params['min_price'])
            max_p = float(params['max_price'])
            if min_p > max_p:
                errors.append("min_price cannot be greater than max_price")
        except (ValueError, TypeError):
            pass  # Already caught above
    
    # Validate rating range
    if 'min_rating' in params:
        try:
            min_rating = float(params['min_rating'])
            if min_rating < 0 or min_rating > 5.0:  # Rating scale 0-5
                errors.append("min_rating must be between 0 and 5")
        except (ValueError, TypeError):
            errors.append("min_rating must be a number")
    
    if 'max_rating' in params:
        try:
            max_rating = float(params['max_rating'])
            if max_rating < 0 or max_rating > 5.0:  # Rating scale 0-5
                errors.append("max_rating must be between 0 and 5")
        except (ValueError, TypeError):
            errors.append("max_rating must be a number")
    
    if 'min_rating' in params and 'max_rating' in params:
        try:
            min_r = float(params['min_rating'])
            max_r = float(params['max_rating'])
            if min_r > max_r:
                errors.append("min_rating cannot be greater than max_rating")
        except (ValueError, TypeError):
            pass  # Already caught above
    
    return errors

@app.route('/products', methods=['GET'])
def get_products():
    # Get query parameters
    params = request.args.to_dict()
    
    # Validate all filter parameters
    validation_errors = validate_filter_params(params)
    if validation_errors:
        return jsonify({'error': 'Validation failed', 'details': validation_errors}), 400
    
    # Build parameterized query with whitelist-safe category
    query = """
        SELECT id, name, category, price, rating 
        FROM products 
        WHERE 1=1
    """
    
    # Prepare parameters for the query
    query_params = []
    
    if 'category' in params:
        query += " AND category = %s"
        query_params.append(params['category'])
    
    if 'min_price' in params:
        try:
            min_price = float(params['min_price'])
            query += " AND price >= %s"
            query_params.append(min_price)
        except (ValueError, TypeError):
            pass  # Already validated
    
    if 'max_price' in params:
        try:
            max_price = float(params['max_price'])
            query += " AND price <= %s"
            query_params.append(max_price)
        except (ValueError, TypeError):
            pass  # Already validated
    
    if 'min_rating' in params:
        try:
            min_rating = float(params['min_rating'])
            query += " AND rating >= %s"
            query_params.append(min_rating)
        except (ValueError, TypeError):
            pass  # Already validated
    
    if 'max_rating' in params:
        try:
            max_rating = float(params['max_rating'])
            query += " AND rating <= %s"
            query_params.append(max_rating)
        except (ValueError, TypeError):
            pass  # Already validated
    
    # Execute the parameterized query
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="your_database",
            user="your_user",
            password="your_password"
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(query, query_params)
        products = cur.fetchall()
        cur.close()
        conn.close()
        
        # Convert to list of dicts (RealDictCursor already does this)
        return jsonify([dict(product) for product in products])
    
    except Exception as e:
        return jsonify({'error': 'Database error', 'details': str(e)}), 500