from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/search', methods=['GET'])
def search():
    keyword = request.args.get('keyword')
    
    if not keyword:
        return jsonify({"error": "Keyword is required"}), 400
    
    # Validate the keyword to prevent SQL injection
    if not keyword.isalnum() and not any(char in keyword for char in [' ', '-', '_', '.', ':']):
        return jsonify({"error": "Invalid characters in keyword"}), 400
    
    conn = sqlite3.connect('example.db')
    cursor = conn.cursor()
    
    # Use parameterised query to prevent SQL injection
    query = "SELECT * FROM items WHERE name LIKE ?"
    cursor.execute(query, ('%' + keyword + '%',))
    
    results = cursor.fetchall()
    conn.close()
    
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)