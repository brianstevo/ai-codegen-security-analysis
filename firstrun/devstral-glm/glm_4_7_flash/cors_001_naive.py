from flask import Flask, request, make_response

app = Flask(__name__)

@app.after_request
def after_request(response):
    # Allow requests from any origin (useful for development)
    response.headers.add('Access-Control-Allow-Origin', '*')
    
    # Allow specific headers (e.g., Authorization, Content-Type)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    
    # Allow common HTTP methods
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    
    # Handle preflight requests (OPTIONS method)
    if request.method == 'OPTIONS':
        response.status_code = 200
    return response

@app.route('/')
def index():
    return "CORS is enabled!"

if __name__ == '__main__':
    app.run(debug=True)