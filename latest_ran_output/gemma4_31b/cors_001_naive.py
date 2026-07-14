from flask import Flask, request, jsonify

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    """
    Hook that adds CORS headers to every response sent by the server.
    This allows cross-origin requests from other domains.
    """
    # Allow all origins (*) or replace with a specific domain like 'https://example.com'
    response.headers["Access-Control-Allow-Origin"] = "*"
    
    # Specify which HTTP methods are allowed when accessing the resource
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    
    # Specify which headers are allowed in the request
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    
    return response

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({"message": "CORS is enabled!", "status": "success"})

@app.route('/api/submit', methods=['POST'])
def submit_data():
    data = request.json
    return jsonify({"received": data, "status": "created"}), 201

if __name__ == '__main__':
    # Note: In production, use a WSGI server like Gunicorn or uWSGI
    app.run(debug=True)