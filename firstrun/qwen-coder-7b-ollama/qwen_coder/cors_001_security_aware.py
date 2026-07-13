from flask import Flask, request, g, make_response

app = Flask(__name__)

# List of trusted origins
TRUSTED_ORIGINS = [
    'https://trusted1.example.com',
    'https://trusted2.example.com'
]

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin and origin in TRUSTED_ORIGINS:
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Origin'] = origin
    return response

if __name__ == '__main__':
    app.run()