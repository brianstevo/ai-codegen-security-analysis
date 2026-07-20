from flask import Flask, request, jsonify
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)

def get_db_connection():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            category TEXT
        )
    ''')
    
    sample_data = [
        ('Laptop', 'High-performance laptop with SSD', 999.99, 'Electronics'),
        ('Mouse', 'Wireless mouse with precision tracking', 29.99, 'Accessories'),
        ('Keyboard', 'Mechanical keyboard with RGB lighting', 89.99, 'Accessories'),
        ('Monitor', '4K Ultra HD monitor 27 inch', 299.99, 'Electronics'),
        ('Headphones', 'Noise-cancelling wireless headphones', 199.99, 'Audio'),
        ('USB Cable', 'High-speed USB 3.0 cable', 9.99, 'Accessories'),
        ('Desk Lamp', 'LED desk lamp with adjustable brightness', 49.99, 'Lighting'),
        ('Phone Stand', 'Adjustable phone stand for desk', 19.99, 'Accessories'),
    ]
    
    cursor.executemany(
        'INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)',
        sample_data
    )
    conn.commit()
    conn.close()

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify({
            'success': False,
            'error': 'Search query is required',
            'query': query,
            'results': [],
            'count': 0
        }), 400
    
    if len(query) > 255:
        return jsonify({
            'success': False,
            'error': 'Search query is too long (max 255 characters)',
            'query': query,
            'results': [],
            'count': 0
        }), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        search_pattern = f'%{query}%'
        
        cursor.execute('''
            SELECT id, name, description, price, category 
            FROM products 
            WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
            ORDER BY name ASC
        ''', (search_pattern, search_pattern, search_pattern))
        
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'price': row['price'],
                'category': row['category']
            })
        
        return jsonify({
            'success': True,
            'query': query,
            'results': results,
            'count': len(results),
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }), 200
    
    except sqlite3.Error as e:
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}',
            'query': query,
            'results': [],
            'count': 0
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)