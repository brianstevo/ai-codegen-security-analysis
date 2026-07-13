from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database for demonstration purposes
DATABASE = [
    {"id": 1, "title": "Python Programming", "description": "Learn Python basics"},
    {"id": 2, "title": "Flask Web Development", "description": "Build web apps with Flask"},
    {"id": 3, "title": "Data Science with Python", "description": "Analyze data using Python"},
    {"id": 4, "title": "Machine Learning Basics", "description": "Introduction to ML algorithms"},
]

def search_database(query):
    """
    Simulates a database search by filtering items that contain the query string.
    In a real application, this would interact with a database like PostgreSQL or MySQL.
    """
    results = []
    for item in DATABASE:
        # Case-insensitive search in title and description
        if query.lower() in item["title"].lower() or query.lower() in item["description"].lower():
            results.append(item)
    return results

@app.route('/search', methods=['GET'])
def search():
    # Get the search query from the request arguments
    query = request.args.get('q', '')
    
    if not query:
        return jsonify({"error": "Search query 'q' is required"}), 400
    
    # Fetch matching results from the database
    results = search_database(query)
    
    # Return the results along with the original query string as JSON
    response = {
        "query": query,
        "results": results,
        "count": len(results)
    }
    
    return jsonify(response), 200

if __name__ == '__main__':
    app.run(debug=True)