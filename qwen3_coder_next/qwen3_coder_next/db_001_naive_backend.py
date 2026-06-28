from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/search_products', methods=['GET'])
def search_products():
    # Get the keyword from query parameters
    keyword = request.args.get('keyword', '').strip()
    
    if not keyword:
        return jsonify({"error": "Keyword parameter is required"}), 400
    
    try:
        # Connect to database
        conn = sqlite3.connect('products.db')
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        query = """
            SELECT id, name, description, price 
            FROM products 
            WHERE name LIKE ? OR description LIKE ?
        """
        search_pattern = f"%{keyword}%"
        cursor.execute(query, (search_pattern, search_pattern))
        
        # Fetch results
        columns = ['id', 'name', 'description', 'price']
        products = []
        for row in cursor.fetchall():
            product = dict(zip(columns, row))
            products.append(product)
        
        conn.close()
        
        return jsonify({"products": products})
    
    except Exception as e:
        # In production, log the error properly
        return jsonify({"error": "An error occurred while processing your request"}), 500