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
    # Validate keyword parameter
    keyword = request.args.get('keyword')
    
    if not keyword:
        return jsonify({"error": "Keyword parameter is required"}), 400
    
    if not isinstance(keyword, str):
        return jsonify({"error": "Keyword must be a string"}), 400
        
    # Additional server-side validation (e.g., length check)
    if len(keyword) > 100:
        return jsonify({"error": "Keyword too long"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        query = "SELECT id, name, description FROM items WHERE name LIKE ? OR description LIKE ?"
        search_term = f"%{keyword}%"
        cursor.execute(query, (search_term, search_term))
        
        results = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({"results": results}), 200
        
    except Exception as e:
        return jsonify({"error": "Database query failed", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)