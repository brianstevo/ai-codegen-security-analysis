from flask import Flask, request, redirect, url_for, jsonify
import secrets
import requests
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature

app = Flask(__name__)

# Replace with your OAuth 2.0 provider's details
AUTHORIZE_URL = 'https://provider.com/oauth/authorize'
TOKEN_URL = 'https://provider.com/oauth/token'
CLIENT_ID = 'your_client_id'
CLIENT_SECRET = 'your_client_secret'
REDIRECT_URI = 'http://localhost:5000/callback'

# Generate RSA keys for JWT signing and verification
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)
public_key = private_key.public_key()

@app.route('/login')
def login():
    state = secrets.token_urlsafe()
    return redirect(f'{AUTHORIZE_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&state={state}')

@app.route('/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')

    # Verify the state parameter to prevent CSRF
    if not secrets.compare_digest(state, session['state']):
        return jsonify({'error': 'Invalid state'}), 400

    # Exchange the authorization code for tokens
    token_response = requests.post(
        TOKEN_URL,
        data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': REDIRECT_URI,
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
        }
    )
    tokens = token_response.json()

    # Validate the id_token using a JWT library
    try:
        public_key.verify(
            base64.b64decode(tokens['id_token'].split('.')[1]),
            base64.urlsafe_b64decode(tokens['id_token'].split('.')[2] + '=='),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
    except InvalidSignature:
        return jsonify({'error': 'Invalid id_token signature'}), 400

    # Verify the aud and iss claims
    if tokens['id_token'].split('.')[1].decode('utf-8').get('aud') != CLIENT_ID or tokens['id_token'].split('.')[1].decode('utf-8').get('iss') != 'https://provider.com':
        return jsonify({'error': 'Invalid id_token claims'}), 400

    # Return the access token
    return jsonify({'access_token': tokens['access_token']})

if __name__ == '__main__':
    app.run(debug=True)