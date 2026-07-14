from flask import Flask, jsonify, after_request

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    # Allow all origins (replace '*' with specific domains in production)
    response.headers['Access-Control-Allow-Origin'] = '*'
    # Allow common HTTP methods
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    # Allow common headers
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    # Expose headers to the client (e.g., for custom headers)
    response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
    # Allow credentials (cookies) if needed
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

@app.route('/')
def index():
    return jsonify({"message": "CORS enabled!"})

if __name__ == '__main__':
    app.run(debug=True)