from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app)

DATABASE = 'products.db'

def get_db_connection():
    """Create a connection to the SQLite database"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with sample data if it doesn't exist"""
    if not os.path.exists(DATABASE):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create products table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category TEXT
            )
        ''')
        
        # Insert sample data
        sample_products = [
            ('Laptop', 'High-performance laptop for professionals', 999.99, 'Electronics'),
            ('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 'Electronics'),
            ('USB-C Cable', 'Fast charging USB-C cable', 12.99, 'Electronics'),
            ('Office Chair', 'Comfortable office chair with lumbar support', 249.99, 'Furniture'),
            ('Standing Desk', 'Adjustable standing desk for home office', 499.99, 'Furniture'),
            ('Monitor', '27-inch 4K monitor', 399.99, 'Electronics'),
            ('Keyboard', 'Mechanical gaming keyboard', 89.99, 'Electronics'),
            ('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 'Furniture'),
            ('Mouse Pad', 'Large extended mouse pad', 19.99, 'Electronics'),
            ('Webcam', '1080p HD webcam for video calls', 49.99, 'Electronics'),
        ]
        
        for name, description, price, category in sample_products:
            cursor.execute(
                'INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)',
                (name, description, price, category)
            )
        
        conn.commit()
        conn.close()

@app.route('/api/products/search', methods=['GET'])
def search_products():
    """
    Search for products by keyword.
    Query parameter: keyword (required)
    Returns JSON list of matching products
    """
    # Get the keyword from query parameters
    keyword = request.args.get('keyword', '').strip()
    
    # Validate input
    if not keyword:
        return jsonify({
            'success': False,
            'error': 'Keyword parameter is required',
            'data': []
        }), 400
    
    # Limit keyword length to prevent abuse
    if len(keyword) > 100:
        return jsonify({
            'success': False,
            'error': 'Keyword is too long (max 100 characters)',
            'data': []
        }), 400
    
    try:
        # Get database connection
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Search in product name and description using LIKE with wildcards
        # Using parameterized queries to prevent SQL injection
        query = '''
            SELECT id, name, description, price, category
            FROM products
            WHERE LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?)
            ORDER BY name ASC
        '''
        
        search_param = f'%{keyword}%'
        cursor.execute(query, (search_param, search_param))
        
        # Fetch all matching products
        rows = cursor.fetchall()
        conn.close()
        
        # Convert rows to list of dictionaries
        products = []
        for row in rows:
            products.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'price': row['price'],
                'category': row['category']
            })
        
        return jsonify({
            'success': True,
            'keyword': keyword,
            'count': len(products),
            'data': products
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}',
            'data': []
        }), 500

@app.route('/api/products', methods=['GET'])
def get_all_products():
    """Get all products from the database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, description, price, category FROM products ORDER BY name ASC')
        rows = cursor.fetchall()
        conn.close()
        
        products = []
        for row in rows:
            products.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'price': row['price'],
                'category': row['category']
            })
        
        return jsonify({
            'success': True,
            'count': len(products),
            'data': products
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}',
            'data': []
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Product search API is running'
    }), 200

if __name__ == '__main__':
    # Initialize the database with sample data
    init_db()
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000)