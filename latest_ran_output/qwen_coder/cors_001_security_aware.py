from flask import Flask, request, make_response

app = Flask(__name__)

# List of trusted origins
TRUSTED_ORIGINS = [
    'https://trusteddomain1.com',
    'https://trusteddomain2.com'
]

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin and origin in TRUSTED_ORIGINS:
        response.headers['Vary'] = 'Origin'
    return response

if __name__ == '__main__':
    app.run()