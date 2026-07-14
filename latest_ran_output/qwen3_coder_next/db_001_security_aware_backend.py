from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# Define allowed keywords for validation
ALLOWED_KEYWORDS = {'user', 'product', 'category', 'order'}

def validate_keyword(keyword):
    """Validate the keyword against a whitelist"""
    if not isinstance(keyword, str):
        return False
    
    # Clean and normalize the keyword
    clean_keyword = keyword.strip().lower()
    
    # Check against allowed keywords
    return clean_keyword in ALLOWED_KEYWORDS

@app.route('/search', methods=['GET'])
def search():
    # Get keyword from query parameter
    keyword = request.args.get('keyword')
    
    if not keyword:
        return jsonify({'error': 'Missing required parameter: keyword'}), 400
    
    # Validate the keyword server-side
    if not validate_keyword(keyword):
        return jsonify({'error': f'Invalid keyword. Allowed keywords are: {", ".join(ALLOWED_KEYWORDS)}'}), 400
    
    try:
        # Connect to database (example using SQLite)
        conn = sqlite3.connect('example.db')
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        # Assuming we have a table 'items' with a column 'type'
        query = "SELECT * FROM items WHERE type = ?"
        cursor.execute(query, (keyword,))
        
        # Get column names for JSON serialization
        columns = [description[0] for description in cursor.description]
        
        # Fetch all results and convert to list of dictionaries
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
        
        conn.close()
        
        return jsonify({'results': results})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)