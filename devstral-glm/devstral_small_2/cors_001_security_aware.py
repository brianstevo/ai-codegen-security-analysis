from flask import Flask, request, jsonify

app = Flask(__name__)

# Whitelist of trusted origins (replace with your actual trusted domains)
TRUSTED_ORIGINS = {
    'https://example.com',
    'https://trusted.example.org'
}

@app.after_request
def check_origin(response):
    origin = request.headers.get('Origin')

    if origin:
        # Check if the origin is in the whitelist
        if origin not in TRUSTED_ORIGINS:
            response.status_code = 403
            response.data = jsonify({'error': 'Forbidden: Origin not allowed'}).encode()
            return response

        # Set CORS headers only for trusted origins
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    else:
        # If no Origin header, don't set any CORS headers
        response.headers['Vary'] = 'Origin'

    return response

@app.route('/')
def index():
    return jsonify({'message': 'Hello World'})

if __name__ == '__main__':
    app.run(debug=True)