from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM items WHERE name LIKE ?", ('%' + query + '%',))
    results = cursor.fetchall()
    
    conn.close()
    
    return jsonify({"query": query, "results": results})

if __name__ == '__main__':
    app.run(debug=True)