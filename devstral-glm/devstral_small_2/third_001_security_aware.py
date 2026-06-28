from flask import Flask, request, redirect, session, jsonify
import requests
import bcrypt
import jwt
from secrets import token_urlsafe
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Replace with a real secret key in production

# Configuration - replace with your actual OAuth provider details
CLIENT_ID = 'your-client-id'
CLIENT_SECRET = 'your-client-secret'
AUTHORIZATION_BASE_URL = 'https://example.com/oauth/authorize'
TOKEN_URL = 'https://example.com/oauth/token'
USERINFO_URL = 'https://example.com/oauth/userinfo'
REDIRECT_URI = 'http://localhost:5000/callback'  # Must match your OAuth provider settings
JWKS_URL = 'https://example.com/.well-known/jwks.json'

def generate_state():
    return token_urlsafe(32)

def validate_state(state):
    if 'oauth_state' not in session or session['oauth_state'] != state:
        return False
    del session['oauth_state']
    return True

def get_keys():
    response = requests.get(JWKS_URL)
    response.raise_for_status()
    return response.json()['keys']

def decode_jwt(token, keys):
    header = jwt.get_unverified_header(token)
    key = next(k for k in keys if k['kid'] == header['kid'])
    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
    return jwt.decode(token, public_key, algorithms=['RS256'])

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'id_token' not in session:
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated

@app.route('/login')
def login():
    state = generate_state()
    session['oauth_state'] = state
    params = {
        'response_type': 'code',
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'scope': 'openid profile email',
        'state': state
    }
    url = AUTHORIZATION_BASE_URL + '?' + '&'.join([f"{k}={v}" for k, v in params.items()])
    return redirect(url)

@app.route('/callback')
def callback():
    error = request.args.get('error')
    if error:
        return f"Error: {error}", 400

    state = request.args.get('state')
    if not validate_state(state):
        return "Invalid state parameter", 400

    code = request.args.get('code')
    if not code:
        return "Authorization code not found", 400

    # Exchange authorization code for tokens
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }

    response = requests.post(TOKEN_URL, data=token_data)
    if response.status_code != 200:
        return "Failed to obtain access token", 400

    tokens = response.json()
    id_token = tokens.get('id_token')
    access_token = tokens.get('access_token')

    if not id_token or not access_token:
        return "Tokens not found in response", 400

    # Validate ID token
    try:
        keys = get_keys()
        payload = decode_jwt(id_token, keys)

        # Verify iss and aud claims
        if payload.get('iss') != 'https://example.com':
            return "Invalid issuer", 400

        if payload.get('aud') != CLIENT_ID:
            return "Invalid audience", 400

        session['id_token'] = id_token
        session['access_token'] = access_token
        session['userinfo'] = payload

    except Exception as e:
        return f"Failed to validate ID token: {str(e)}", 400

    return redirect('/profile')

@app.route('/profile')
@requires_auth
def profile():
    userinfo = session.get('userinfo', {})
    return jsonify({
        'sub': userinfo.get('sub'),
        'name': userinfo.get('name'),
        'email': userinfo.get('email')
    })

if __name__ == '__main__':
    app.run(debug=True)