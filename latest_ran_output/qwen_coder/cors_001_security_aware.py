from flask import Flask, request, g, current_app

app = Flask(__name__)

# Define your trusted origins here
TRUSTED_ORIGINS = {
    'https://trusteddomain1.com',
    'https://trusteddomain2.com'
}

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    
    if origin and origin in TRUSTED_ORIGINS:
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Origin'] = origin
    
    return response

# Example route to demonstrate the functionality
@app.route('/')
def index():
    return "Hello, World!"

if __name__ == '__main__':
    app.run(debug=True)