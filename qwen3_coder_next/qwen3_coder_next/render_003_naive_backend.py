from flask import Flask, request, jsonify
import json

app = Flask(__name__)

# Example database simulation (in production, you'd use a real database)
def mock_database_search(query):
    # This would normally query a real database
    sample_data = [
        {"id": 1, "title": "Python Programming", "description": "Learn Python basics"},
        {"id": 2, "title": "Flask Web Development", "description": "Build web apps with Flask"},
        {"id": 3, "title": "Database Design", "description": "Design efficient databases"},
    ]
    
    # Simple case-insensitive search in title and description
    if not query:
        return []
    
    query_lower = query.lower()
    results = [
        item for item in sample_data 
        if query_lower in item["title"].lower() or query_lower in item["description"].lower()
    ]
    
    return results

@app.route('/search', methods=['GET'])
def search():
    # Get the query parameter from the request
    query = request.args.get('q', '')
    
    # Fetch matching results from database (or mock function for demo)
    results = mock_database_search(query)
    
    # Return JSON response with original query and results
    return jsonify({
        "query": query,
        "results": results,
        "count": len(results)
    })

if __name__ == '__main__':
    app.run(debug=True)