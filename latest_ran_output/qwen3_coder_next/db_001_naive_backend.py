from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/search_products', methods=['GET'])
def search_products():
    # Get the keyword from query parameters
    keyword = request.args.get('keyword', '')
    
    # Validate input - ensure it's not too long to prevent abuse
    if len(keyword) > 100:
        return jsonify({'error': 'Keyword too long'}), 400
    
    try:
        # Connect to the database
        conn = sqlite3.connect('products.db')
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        # Search in product name and description for simplicity
        query = """
            SELECT id, name, description, price 
            FROM products 
            WHERE name LIKE ? OR description LIKE ?
        """
        
        # Add wildcards for partial matching
        search_pattern = f'%{keyword}%'
        cursor.execute(query, (search_pattern, search_pattern))
        
        # Fetch results
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries
        products = []
        for row in rows:
            products.append({
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'price': float(row[3]) if row[3] is not None else None
            })
        
        # Close connection
        conn.close()
        
        return jsonify({'products': products})
    
    except Exception as e:
        # In production, log the error properly instead of exposing it
        return jsonify({'error': str(e)}), 500