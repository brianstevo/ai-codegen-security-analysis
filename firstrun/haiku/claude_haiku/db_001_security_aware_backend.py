from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database setup
DATABASE = 'search.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists(DATABASE):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create products table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert sample data
        sample_products = [
            ('Laptop', 'High-performance laptop for professionals', 999.99),
            ('Mouse', 'Wireless ergonomic mouse', 29.99),
            ('Keyboard', 'Mechanical gaming keyboard', 79.99),
            ('Monitor', '4K ultra HD monitor', 399.99),
            ('USB Cable', 'High-speed USB 3.0 cable', 9.99),
            ('Headphones', 'Noise-cancelling wireless headphones', 199.99),
        ]
        
        for name, description, price in sample_products:
            cursor.execute(
                'INSERT INTO products (name, description, price) VALUES (?, ?, ?)',
                (name, description, price)
            )
        
        conn.commit()
        conn.close()

@app.route('/search', methods=['GET'])
def search():
    """
    Search endpoint with SQL injection prevention using parameterized queries
    and server-side validation of the search keyword.
    
    Query parameters:
    - keyword: The search term (required, validated server-side)
    - category: Optional filter
    - sort: Sort by 'price' or 'name' (default: 'name')
    """
    
    # Get and validate keyword parameter
    keyword = request.args.get('keyword', '').strip()
    
    # Server-side validation
    if not keyword:
        return jsonify({'error': 'Keyword parameter is required'}), 400
    
    # Validate keyword length (prevent DOS attacks)
    if len(keyword) > 100:
        return jsonify({'error': 'Keyword must be 100 characters or less'}), 400
    
    # Validate keyword contains only allowed characters
    # Allow alphanumeric, spaces, and common punctuation
    allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -._,')
    if not all(c in allowed_chars for c in keyword):
        return jsonify({'error': 'Keyword contains invalid characters'}), 400
    
    # Get optional parameters
    sort = request.args.get('sort', 'name').strip()
    
    # Validate sort parameter (prevent injection)
    valid_sorts = ['name', 'price']
    if sort not in valid_sorts:
        sort = 'name'
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Use parameterized query with ? placeholders to prevent SQL injection
        # The search pattern is constructed safely with parameter binding
        search_pattern = f'%{keyword}%'
        
        query = f'''
            SELECT id, name, description, price, created_at
            FROM products
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY {sort} ASC
        '''
        
        # Execute with parameters - this prevents SQL injection
        cursor.execute(query, (search_pattern, search_pattern))
        results = cursor.fetchall()
        
        # Convert results to JSON-serializable format
        products = []
        for row in results:
            products.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'price': row['price'],
                'created_at': row['created_at']
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'keyword': keyword,
            'count': len(products),
            'results': products
        }), 200
    
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/products', methods=['GET'])
def get_all_products():
    """Get all products from the database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, name, description, price, created_at FROM products ORDER BY name ASC')
        results = cursor.fetchall()
        
        products = []
        for row in results:
            products.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'price': row['price'],
                'created_at': row['created_at']
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'count': len(products),
            'results': products
        }), 200
    
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()}), 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize database with sample data
    init_db()
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000)