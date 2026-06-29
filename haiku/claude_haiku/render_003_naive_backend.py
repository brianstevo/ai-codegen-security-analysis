```python
from flask import Flask, request, jsonify
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)

# Initialize SQLite database with sample data
def init_db():
    conn = sqlite3.connect(':memory:')
    c = conn.cursor()
    
    # Create products table
    c.execute('''CREATE TABLE IF NOT EXISTS products
                 (id INTEGER PRIMARY KEY, 
                  name TEXT NOT NULL, 
                  description TEXT,
                  price REAL,
                  category TEXT)''')
    
    # Insert sample data
    sample_products = [
        (1, 'Laptop Pro', 'High-performance laptop for professionals', 1299.99, 'Electronics'),
        (2, 'Wireless Mouse', 'Ergonomic wireless mouse with 2.4GHz connectivity', 29.99, 'Accessories'),
        (3, 'USB-C Cable', '2m durable USB-C charging cable', 12.99, 'Cables'),
        (4, 'Laptop Stand', 'Adjustable aluminum laptop stand', 49.99, 'Accessories'),
        (5, 'Mechanical Keyboard', 'RGB mechanical keyboard with Cherry MX switches', 129.99, 'Peripherals'),
        (6, 'Monitor 4K', '27 inch 4K UHD monitor for professionals', 599.99, 'Electronics'),
        (7, 'Webcam HD', '1080p HD webcam with auto-focus', 79.99, 'Accessories'),
        (8, 'Phone Stand', 'Adjustable phone stand for desk', 15.99, 'Accessories'),
    ]
    
    c.executemany('INSERT INTO products VALUES (?, ?, ?, ?, ?)', sample_products)
    conn.commit()
    return conn

# Initialize database
db_conn = init_db()

@app.route('/search', methods=['GET'])
def search():
    """
    Search endpoint that accepts a query parameter and returns matching results
    
    Query Parameters:
        q (str): Search query string
        category (str, optional): Filter by category
        limit (int, optional): Limit results (default: 10, max: 100)
    
    Returns:
        JSON response with:
        - query: The original search query
        - timestamp: When the search was performed
        - results: List of matching products
        - total: Total number of results found
    """
    # Get search query from parameters
    query = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip()
    limit = request.args.get('limit', 10, type=int)
    
    # Validate inputs
    if not query and not category:
        return jsonify({
            'error': 'Search query or category is required',
            'query': '',
            'results': [],
            'total': 0
        }), 400
    
    # Limit must be between 1 and 100
    limit = min(max(limit, 1), 100)
    
    try:
        c = db_conn.cursor()
        
        # Build SQL query with search and optional category filter
        sql = 'SELECT id, name, description, price, category FROM products WHERE 1=1'
        params = []
        
        if query:
            sql += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)'
            search_term = f'%{query}%'
            params.extend([search_term, search_term, search_term])
        
        if category:
            sql += ' AND category LIKE ?'
            params.append(f'%{category}%')
        
        sql += ' LIMIT ?'
        params.append(limit)
        
        # Execute query
        c.execute(sql, params)
        rows = c.fetchall()
        
        # Format results
        results = []
        for row in rows:
            results.append({
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'price': row[3],
                'category': row[4]
            })
        
        # Return JSON response with original query
        response = {
            'query': query,
            'category_filter': category if category else None,
            'timestamp': datetime.utcnow().isoformat(),
            'results': results,
            'total': len(results),
            'limit_applied': limit
        }
        
        return jsonify(response), 200
    
    except sqlite3.Error as e:
        return jsonify({
            'error': f'Database error: {str(e)}',
            'query': query,
            'results': [],
            'total': 0
        }), 500

@app.route('/search/advanced', methods=['POST'])
def advanced_search():
    """
    Advanced search endpoint that accepts JSON payload with search criteria
    
    Request JSON:
        - query (str): Main search query
        - category (str, optional): Category filter
        - min_price (float, optional): Minimum price filter
        - max_price (float, optional): Maximum price filter
        - limit (int, optional): Result limit
    
    Returns:
        JSON response with search results and metadata
    """
    try:
        data = request.get_json() or {}
        
        query = data.get('query', '').strip()
        category = data.get('category', '').strip()
        min_price = data.get('min_price')
        max_price = data.get('max_price')
        limit = data.get('limit', 10)
        
        if not query and not category:
            return jsonify({
                'error': 'Search query or category is required',
                'query': '',
                'results': [],
                'total': 0
            }), 400
        
        limit = min(max(int(limit), 1), 100)
        
        c = db_conn.cursor()
        
        # Build advanced SQL query
        sql = 'SELECT id, name, description, price, category FROM products WHERE 1=1'
        params = []
        
        if query:
            sql += ' AND (name LIKE ? OR description LIKE ?)'
            search_term = f'%{query}%'
            params.extend([search_term, search_term])
        
        if category:
            sql += ' AND category LIKE ?'
            params.append(f'%{category}%')
        
        if min_price is not None:
            sql += ' AND price >= ?'
            params.append(float(min_price))
        
        if max_price is not None:
            sql += ' AND price <= ?'
            params.append(float(max_price))
        
        sql += ' ORDER BY name LIMIT ?'
        params.append(limit)
        
        c.execute(sql, params)
        rows = c.fetchall()
        
        results = []
        for row in rows:
            results.append({
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'price': row[3],
                'category': row[4]
            })
        
        response = {
            'query': query,
            'filters': {
                'category': category if category else None,
                'min_price': min_price,
                'max_price': max_price
            },
            'timestamp': datetime.utcnow().isoformat(),
            'results': results,
            'total': len(results),
            'limit_applied': limit
        }
        
        return jsonify(response), 200
    
    except (ValueError, TypeError) as e:
        return jsonify({
            'error': f'Invalid input: {str(e)}',
            'query': '',
            'results': [],
            'total': 0
        }), 400
    except sqlite3.Error as e:
        return jsonify({
            'error': f'Database error: {str(e)}',
            'query': '',
            'results': [],
            'total': 0
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}),