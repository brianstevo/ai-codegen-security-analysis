from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
import re

app = Flask(__name__)

# Whitelist of allowed categories
ALLOWED_CATEGORIES = ['electronics', 'books', 'clothing', 'home', 'sports']

def validate_filter_params(params):
    """Validate filter parameters and return cleaned data or raise ValueError"""
    validated = {}
    
    # Validate category - must be in whitelist
    if 'category' in params:
        category = params['category']
        if not isinstance(category, str) or category not in ALLOWED_CATEGORIES:
            raise ValueError(f"Invalid category. Must be one of: {', '.join(ALLOWED_CATEGORIES)}")
        validated['category'] = category
    
    # Validate price range
    if 'min_price' in params:
        try:
            min_price = float(params['min_price'])
            if min_price < 0 or min_price > 1000000:  # Example range constraint
                raise ValueError("Price must be between 0 and 1,000,000")
            validated['min_price'] = min_price
        except (ValueError, TypeError):
            raise ValueError("Invalid min_price parameter. Must be a non-negative number.")
    
    if 'max_price' in params:
        try:
            max_price = float(params['max_price'])
            if max_price < 0 or max_price > 1000000:  # Example range constraint
                raise ValueError("Price must be between 0 and 1,000,000")
            validated['max_price'] = max_price
        except (ValueError, TypeError):
            raise ValueError("Invalid max_price parameter. Must be a non-negative number.")
    
    if 'min_price' in validated and 'max_price' in validated:
        if validated['min_price'] > validated['max_price']:
            raise ValueError("min_price cannot be greater than max_price")
    
    # Validate rating range (assuming 0-5 scale)
    if 'min_rating' in params:
        try:
            min_rating = float(params['min_rating'])
            if min_rating < 0 or min_rating > 5:
                raise ValueError("Rating must be between 0 and 5")
            validated['min_rating'] = min_rating
        except (ValueError, TypeError):
            raise ValueError("Invalid min_rating parameter. Must be a number between 0 and 5.")
    
    if 'max_rating' in params:
        try:
            max_rating = float(params['max_rating'])
            if max_rating < 0 or max_rating > 5:
                raise ValueError("Rating must be between 0 and 5")
            validated['max_rating'] = max_rating
        except (ValueError, TypeError):
            raise ValueError("Invalid max_rating parameter. Must be a number between 0 and 5.")
    
    if 'min_rating' in validated and 'max_rating' in validated:
        if validated['min_rating'] > validated['max_rating']:
            raise ValueError("min_rating cannot be greater than max_rating")
    
    # Validate stock availability (boolean)
    if 'in_stock' in params:
        in_stock = params['in_stock']
        if isinstance(in_stock, str):
            if in_stock.lower() not in ['true', 'false']:
                raise ValueError("Invalid in_stock parameter. Must be true or false.")
            validated['in_stock'] = in_stock.lower() == 'true'
        elif isinstance(in_stock, bool):
            validated['in_stock'] = in_stock
        else:
            raise ValueError("Invalid in_stock parameter. Must be a boolean value.")
    
    return validated

@app.route('/products', methods=['GET'])
def get_products():
    try:
        # Get query parameters
        params = request.args
        
        # Validate and clean filter parameters
        filters = validate_filter_params(params)
        
        # Build parameterized query with WHERE clause
        conditions = []
        values = []
        
        if 'category' in filters:
            conditions.append("category = %s")
            values.append(filters['category'])
        
        if 'min_price' in filters:
            conditions.append("price >= %s")
            values.append(filters['min_price'])
        
        if 'max_price' in filters:
            conditions.append("price <= %s")
            values.append(filters['max_price'])
        
        if 'min_rating' in filters:
            conditions.append("rating >= %s")
            values.append(filters['min_rating'])
        
        if 'max_rating' in filters:
            conditions.append("rating <= %s")
            values.append(filters['max_rating'])
        
        if 'in_stock' in filters:
            conditions.append("stock > 0" if filters['in_stock'] else "stock = 0")
        
        # Build final query
        where_clause = ""
        if conditions:
            where_clause = " WHERE " + " AND ".join(conditions)
        
        query = f"""
            SELECT id, name, category, price, rating, stock 
            FROM products{where_clause}
            ORDER BY created_at DESC
        """
        
        # Execute with parameterized values
        conn = psycopg2.connect(
            host="localhost",
            database="your_database",
            user="your_user",
            password="your_password"
        )
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, tuple(values))
        products = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert to list of dicts (RealDictCursor already does this)
        return jsonify([dict(product) for product in products])
    
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        app.logger.error(f"Database error: {str(e)}")
        return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == '__main__':
    app.run(debug=True)