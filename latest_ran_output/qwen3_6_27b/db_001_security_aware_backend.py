from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = 'example.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/search', methods=['GET'])
def search_items():
    keyword = request.args.get('keyword')
    
    # Server-side validation: Check if keyword is provided and is a string
    if not keyword or not isinstance(keyword, str):
        return jsonify({"error": "Invalid or missing keyword parameter"}), 400
    
    # Additional validation: Limit length to prevent abuse (e.g., max 100 chars)
    if len(keyword) > 100:
        return jsonify({"error": "Keyword too long"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        # The '?' placeholder is replaced by the driver safely
        query = "SELECT id, name, description FROM items WHERE name LIKE ? OR description LIKE ?"
        search_term = f"%{keyword}%"
        cursor.execute(query, (search_term, search_term))
        
        results = cursor.fetchall()
        
        # Convert rows to list of dictionaries for JSON serialization
        items = [dict(row) for row in results]
        
        conn.close()
        
        return jsonify({"results": items}), 200
        
    except Exception as e:
        return jsonify({"error": "Database query failed", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)