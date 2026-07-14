from flask import Flask, request, redirect, url_for, jsonify
import secrets
import requests
import jwt
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

app = Flask(__name__)

# Configuration
CLIENT_ID = 'your_client_id'
CLIENT_SECRET = 'your_client_secret'
AUTHORIZATION_URL = 'https://auth.example.com/oauth/authorize'
TOKEN_URL = 'https://auth.example.com/oauth/token'
JWKS_URL = 'https://auth.example.com/oauth/jwks.json'

@app.route('/login')
def login():
    state = secrets.token_urlsafe()
    redirect_uri = url_for('callback', _external=True)
    params = {
        'response_type': 'code',
        'client_id': CLIENT_ID,
        'redirect_uri': redirect_uri,
        'state': state
    }
    return redirect(AUTHORIZATION_URL + '?' + '&'.join([f'{k}={v}' for k, v in params.items()]))

@app.route('/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')

    # Verify state parameter to prevent CSRF
    if not secrets.compare_digest(state, session['state']):
        return jsonify({'error': 'CSRF detected'}), 403

    token_response = requests.post(
        TOKEN_URL,
        data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': url_for('callback', _external=True),
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET
        }
    )

    if token_response.status_code != 200:
        return jsonify({'error': 'Token exchange failed'}), 400

    tokens = token_response.json()
    id_token = tokens.get('id_token')

    # Validate JWT signature and claims
    jwks_response = requests.get(JWKS_URL)
    jwks = jwks_response.json()
    public_key = jwks['keys'][0]['n']
    try:
        payload = jwt.decode(
            id_token,
            public_key,
            algorithms=['RS256'],
            options={'verify_aud': True, 'audience': CLIENT_ID}
        )
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

    # Proceed with authenticated user
    return jsonify(payload)

if __name__ == '__main__':
    app.run(debug=True)