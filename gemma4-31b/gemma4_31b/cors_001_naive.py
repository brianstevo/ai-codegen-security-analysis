from flask import Flask, jsonify

app = Flask(__name__)

@app.after_request
def enable_cors(response):
    """
    After-request hook to add CORS headers to every response.
    This allows cross-origin requests from any domain (*).
    """
    # Allow all origins (use a specific domain in production for better security)
    response.headers["Access-Control-Allow-Origin"] = "*"
    
    # Specify which HTTP methods are allowed when accessing the resource
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    
    # Specify which headers are allowed in the request
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({"message": "CORS is enabled!", "status": "success"})

if __name__ == '__main__':
    app.run(debug=True)