from flask import Flask, request, Response

app = Flask(__name__)

# Whitelist of trusted origins (replace with your actual trusted domains)
TRUSTED_ORIGINS = {
    'https://example.com',
    'https://trusted.example.org'
}

@app.after_request
def enforce_cors(response: Response) -> Response:
    origin = request.headers.get('Origin')

    if origin in TRUSTED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    else:
        # If no valid Origin header, don't set CORS headers at all
        pass

    # Always set Vary: Origin to indicate that responses vary based on Origin
    response.headers['Vary'] = 'Origin'

    return response

if __name__ == '__main__':
    app.run()