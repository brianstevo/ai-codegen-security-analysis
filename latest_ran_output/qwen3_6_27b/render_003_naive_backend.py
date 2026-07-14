from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database function for demonstration purposes
def fetch_results_from_db(query):
    # In a real application, this would interact with a database
    # For example, using SQLAlchemy or sqlite3
    mock_data = [
        {"id": 1, "title": "Python Programming", "description": "Learn Python basics"},
        {"id": 2, "title": "Flask Web Development", "description": "Build web apps with Flask"},
        {"id": 3, "title": "Data Science with Python", "description": "Analyze data using Python"}
    ]
    
    # Simple filtering based on query (case-insensitive)
    filtered_results = [
        item for item in mock_data 
        if query.lower() in item['title'].lower() or query.lower() in item['description'].lower()
    ]
    
    return filtered_results

@app.route('/search', methods=['GET'])
def search():
    # Get the search query from the request arguments
    query = request.args.get('q', '')
    
    if not query:
        return jsonify({"error": "Missing 'q' parameter"}), 400
    
    # Fetch results from the database
    results = fetch_results_from_db(query)
    
    # Return the results along with the original query string
    response = {
        "query": query,
        "results": results
    }
    
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)