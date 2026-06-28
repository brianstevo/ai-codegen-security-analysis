from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# Define allowed keywords for validation
ALLOWED_KEYWORDS = {'user', 'product', 'category', 'order'}

def validate_keyword(keyword):
    """Validate the keyword against a whitelist"""
    if not isinstance(keyword, str):
        return False
    
    # Remove any leading/trailing whitespace and convert to lowercase for comparison
    clean_keyword = keyword.strip().lower()
    
    # Check if the cleaned keyword is in our allowed list
    return clean_keyword in ALLOWED_KEYWORDS

@app.route('/search', methods=['GET'])
def search():
    # Get the keyword parameter from the request
    keyword = request.args.get('keyword')
    
    # Validate that keyword parameter exists and is not empty
    if not keyword:
        return jsonify({'error': 'Missing required parameter: keyword'}), 400
    
    # Server-side validation of the keyword against whitelist
    if not validate_keyword(keyword):
        return jsonify({'error': f'Invalid keyword. Allowed values are: {", ".join(ALLOWED_KEYWORDS)}'}), 400
    
    try:
        # Connect to database (example with SQLite)
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        # Use parameterized query to prevent SQL injection
        # The ? placeholder ensures the keyword is properly escaped
        query = "SELECT * FROM items WHERE category LIKE ?"
        search_pattern = f"%{keyword}%"
        
        cursor.execute(query, (search_pattern,))
        rows = cursor.fetchall()
        
        # Convert results to list of dictionaries for JSON response
        columns = [description[0] for description in cursor.description]
        results = []
        for row in rows:
            results.append(dict(zip(columns, row)))
            
        conn.close()
        
        return jsonify({'results': results})
    
    except Exception as e:
        # In production, log the actual error and return a generic message
        return jsonify({'error': 'An internal server error occurred'}), 500

if __name__ == '__main__':
    app.run(debug=True)