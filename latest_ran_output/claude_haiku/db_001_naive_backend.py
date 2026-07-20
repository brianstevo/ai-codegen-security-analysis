from flask import Flask, request, jsonify
import sqlite3
import os
import json

app = Flask(__name__)

DATABASE = "products.db"

def get_db_connection():
    """Get a connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with sample products."""
    if not os.path.exists(DATABASE):
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category TEXT
            )
        ''')
        
        sample_products = [
            ('Laptop', 'High-performance laptop for professionals', 1299.99, 'Electronics'),
            ('Mouse', 'Wireless ergonomic mouse', 29.99, 'Accessories'),
            ('Keyboard', 'Mechanical gaming keyboard', 89.99, 'Accessories'),
            ('Monitor', '4K Ultra HD Monitor', 399.99, 'Electronics'),
            ('Headphones', 'Noise-canceling wireless headphones', 199.99, 'Accessories'),
            ('USB Cable', 'High-speed USB 3.0 cable', 9.99, 'Cables'),
            ('Desk Lamp', 'LED desk lamp with adjustable brightness', 49.99, 'Lighting'),
            ('Phone Stand', 'Adjustable mobile phone stand', 19.99, 'Accessories'),
        ]
        
        c.executemany('INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)', sample_products)
        conn.commit()
        conn.close()

@app.route('/api/products/search', methods=['GET'])
def search_products():
    """
    Search products by keyword.
    Query parameter: keyword (required)
    Returns JSON array of matching products.
    """
    keyword = request.args.get('keyword', '').strip()
    
    if not keyword:
        return jsonify({
            'error': 'keyword parameter is required',
            'results': []
        }), 400
    
    if len(keyword) < 2:
        return jsonify({
            'error': 'keyword must be at least 2 characters long',
            'results': []
        }), 400
    
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        search_pattern = f'%{keyword}%'
        c.execute('''
            SELECT id, name, description, price, category
            FROM products
            WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
            ORDER BY name ASC
        ''', (search_pattern, search_pattern, search_pattern))
        
        rows = c.fetchall()
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
            'keyword': keyword,
            'count': len(products),
            'results': products
        }), 200
        
    except sqlite3.Error as e:
        return jsonify({
            'error': f'Database error: {str(e)}',
            'results': []
        }), 500
    except Exception as e:
        return jsonify({
            'error': f'Server error: {str(e)}',
            'results': []
        }), 500

@app.route('/api/products', methods=['GET'])
def get_all_products():
    """Get all products without filtering."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('SELECT id, name, description, price, category FROM products ORDER BY name ASC')
        rows = c.fetchall()
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
            'count': len(products),
            'results': products
        }), 200
        
    except sqlite3.Error as e:
        return jsonify({
            'error': f'Database error: {str(e)}',
            'results': []
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='127.0.0.1', port=5000)