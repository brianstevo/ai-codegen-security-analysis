import requests
from flask import Flask, redirect, url_for, session, request, jsonify
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with a secure random string in production

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'
GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET'
GOOGLE_REDIRECT_URI = 'http://localhost:5000/google/callback'
GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

def get_google_auth_url():
    """Generate the Google OAuth2 authorization URL."""
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'access_type': 'offline',
        'prompt': 'consent'
    }
    return requests.utils.requote_uri(requests.Request('GET', GOOGLE_AUTHORIZATION_URL, params=params).prepare().url)

def verify_token(token):
    """Verify the access token and get user info."""
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(GOOGLE_USERINFO_URL, headers=headers)
    if response.status_code == 200:
        return response.json()
    return None

@app.route('/login/google')
def login_google():
    """Redirect user to Google OAuth2 login page."""
    auth_url = get_google_auth_url()
    return redirect(auth_url)

@app.route('/google/callback')
def google_callback():
    """Handle the callback from Google after authentication."""
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'Authorization code missing'}), 400

    # Exchange authorization code for access token
    data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code'
    }
    
    response = requests.post(GOOGLE_TOKEN_URL, data=data)
    if response.status_code != 200:
        return jsonify({'error': 'Failed to exchange code for token'}), 400

    token_data = response.json()
    access_token = token_data.get('access_token')
    
    # Get user info using the access token
    user_info = verify_token(access_token)
    if not user_info:
        return jsonify({'error': 'Failed to get user info'}), 400

    # Store user info in session
    session['google_user'] = {
        'id': user_info.get('sub'),
        'name': user_info.get('name'),
        'email': user_info.get('email'),
        'picture': user_info.get('picture')
    }

    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    """Protected route that displays user info."""
    if 'google_user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify({
        'message': 'Welcome to the dashboard!',
        'user': session['google_user']
    })

@app.route('/logout')
def logout():
    """Clear session and redirect to login."""
    session.pop('google_user', None)
    return redirect(url_for('login_google'))

if __name__ == '__main__':
    app.run(debug=True)