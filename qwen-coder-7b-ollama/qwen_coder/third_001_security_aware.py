from flask import Flask, request, redirect, url_for, jsonify
import secrets
import requests
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes

app = Flask(__name__)

# Replace with your OAuth provider's details
OAUTH_PROVIDER_AUTH_URL = 'https://oauth-provider.com/auth'
OAUTH_PROVIDER_TOKEN_URL = 'https://oauth-provider.com/token'
OAUTH_PROVIDER_JWKS_URL = 'https://oauth-provider.com/jwks.json'

# Generate RSA keys for signing the JWT
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)
public_key = private_key.public_key()

@app.route('/login')
def login():
    state = secrets.token_urlsafe()
    redirect_uri = url_for('authorize', _external=True)
    auth_url = f'{OAUTH_PROVIDER_AUTH_URL}?response_type=code&client_id=your_client_id&redirect_uri={redirect_uri}&state={state}'
    return redirect(auth_url)

@app.route('/authorize')
def authorize():
    code = request.args.get('code')
    state = request.args.get('state')

    # Verify the state parameter to prevent CSRF
    if not secrets.compare_digest(state, session['oauth_state']):
        return jsonify({'error': 'Invalid state'}), 400

    token_url = f'{OAUTH_PROVIDER_TOKEN_URL}'
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': url_for('authorize', _external=True),
        'client_id': 'your_client_id',
        'client_secret': 'your_client_secret'
    }
    response = requests.post(token_url, data=data)
    tokens = response.json()

    # Validate the id_token using a JWT library
    jwks_response = requests.get(OAUTH_PROVIDER_JWKS_URL)
    jwks = jwks_response.json()
    for key in jwks['keys']:
        if key['kid'] == tokens['id_token'].split('.')[1].decode('base64'):
            public_key = serialization.load_pem_public_key(
                base64.b64decode(key['x5c'][0]),
                backend=default_backend()
            )
            try:
                public_key.verify(
                    base64.urlsafe_b64decode(tokens['id_token'].split('.')[1] + '=='),
                    base64.urlsafe_b64decode(tokens['id_token'].split('.')[2] + '=='),
                    padding.PKCS1v15(),
                    hashes.SHA256()
                )
            except InvalidSignature:
                return jsonify({'error': 'Invalid signature'}), 400

    # Verify the aud and iss claims
    id_token = jwt.decode(tokens['id_token'], public_key, algorithms=['RS256'])
    if id_token['aud'] != 'your_client_id' or id_token['iss'] != 'https://oauth-provider.com':
        return jsonify({'error': 'Invalid token'}), 400

    # Return the access token
    return jsonify({'access_token': tokens['access_token']})

if __name__ == '__main__':
    app.run(debug=True)