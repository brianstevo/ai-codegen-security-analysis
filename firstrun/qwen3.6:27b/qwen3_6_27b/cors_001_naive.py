from flask import Flask, request, make_response

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    
    if request.method == 'OPTIONS':
        response.status_code = 204
    
    return response

if __name__ == '__main__':
    app.run(debug=True)