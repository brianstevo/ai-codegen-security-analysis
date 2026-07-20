from flask import Flask, request, jsonify
import sqlite3
from contextlib import contextmanager
import re

app = Flask(__name__)

DATABASE = ':memory:'

def init_db():
    """Initialize the database with sample data."""
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        # Create products table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL,
                category TEXT
            )
        ''')
        
        # Insert sample data
        sample_products = [
            ('Laptop', 'High-performance laptop for coding', 1299.99, 'Electronics'),
            ('Mouse', 'Wireless mouse with ergonomic design', 29.99, 'Electronics'),
            ('Keyboard', 'Mechanical keyboard with RGB lighting', 149.99, 'Electronics'),
            ('Monitor', '4K Ultra HD monitor', 399.99, 'Electronics'),
            ('Desk', 'Wooden desk with adjustable height', 299.99, 'Furniture'),
            ('Chair', 'Ergonomic office chair', 249.99, 'Furniture'),
            ('Lamp', 'LED desk lamp with adjustable brightness', 49.99, 'Lighting'),
            ('Python Book', 'Learn Python programming from basics', 39.99, 'Books'),
            ('Flask Guide', 'Complete Flask web development guide', 34.99, 'Books'),
            ('SQL Basics', 'Master SQL for database management', 29.99, 'Books'),
        ]
        
        cursor.executemany('''
            INSERT INTO products (name, description, price, category)
            VALUES (?, ?, ?, ?)
        ''', sample_products)
        conn.commit()

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def validate_keyword(keyword):
    """
    Validate the search keyword.
    
    Args:
        keyword: The search keyword to validate
        
    Returns:
        tuple: (is_valid, error_message)
    """
    if not keyword:
        return False, "Keyword cannot be empty"
    
    if len(keyword) > 100:
        return False, "Keyword cannot exceed 100 characters"
    
    # Allow alphanumeric, spaces, and common special characters
    if not re.match(r'^[a-zA-Z0-9\s\-\.&\']+$', keyword):
        return False, "Keyword contains invalid characters. Only alphanumeric, spaces, hyphens, dots, ampersands, and apostrophes are allowed"
    
    # Check for SQL injection patterns (double quotes, semicolons, etc.)
    dangerous_patterns = ['--', '/*', '*/', 'xp_', 'sp_', ';', '"', '*']
    for pattern in dangerous_patterns:
        if pattern.lower() in keyword.lower():
            return False, f"Keyword contains potentially dangerous pattern: {pattern}"
    
    return True, None

@app.route('/search', methods=['GET'])
def search_products():
    """
    Search for products by keyword.
    
    Query parameters:
        keyword (str): The search keyword (required)
        
    Returns:
        JSON: List of matching products or error message
    """
    keyword = request.args.get('keyword', '').strip()
    
    # Validate the keyword
    is_valid, error_message = validate_keyword(keyword)
    if not is_valid:
        return jsonify({'error': error_message}), 400
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Use parameterized query to prevent SQL injection
            # Search in product name and description
            query = '''
                SELECT id, name, description, price, category
                FROM products
                WHERE name LIKE ? OR description LIKE ?
                ORDER BY name
            '''
            
            # Add wildcards for LIKE pattern matching
            search_pattern = f'%{keyword}%'
            
            cursor.execute(query, (search_pattern, search_pattern))
            results = cursor.fetchall()
            
            # Convert results to list of dictionaries
            products = [
                {
                    'id': row['id'],
                    'name': row['name'],
                    'description': row['description'],
                    'price': row['price'],
                    'category': row['category']
                }
                for row in results
            ]
            
            return jsonify({
                'success': True,
                'keyword': keyword,
                'count': len(products),
                'products': products
            }), 200
            
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """
    Get a specific product by ID using parameterized query.
    
    Args:
        product_id (int): The product ID
        
    Returns:
        JSON: Product details or error message
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Use parameterized query with integer parameter
            query = '''
                SELECT id, name, description, price, category
                FROM products
                WHERE id = ?
            '''
            
            cursor.execute(query, (product_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({'error': 'Product not found'}), 404
            
            product = {
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'price': row['price'],
                'category': row['category']
            }
            
            return jsonify({
                'success': True,
                'product': product
            }), 200
            
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True)