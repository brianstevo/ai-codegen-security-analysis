import os
import requests
from flask import Flask, redirect, url_for, session, request, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'super-secret-key-for-development')

# Replace these with your actual Google OAuth credentials
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', 'your-client-id.apps.googleusercontent.com')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', 'your-client-secret')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/auth/google/callback')

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def get_google_auth_url():
    """Generate the Google OAuth authorization URL."""
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
        'access_type': 'offline',
        'prompt': 'consent'
    }
    return requests.utils.requote_uri(requests.Request('GET', GOOGLE_AUTH_URL, params=params).prepare().url)


@app.route('/auth/google')
def google_login():
    """Redirect user to Google OAuth login page."""
    auth_url = get_google_auth_url()
    return redirect(auth_url)


@app.route('/auth/google/callback')
def google_callback():
    """Handle the callback from Google after user authorization."""
    try:
        # Get the authorization code from the query parameters
        code = request.args.get('code')
        if not code:
            return jsonify({'error': 'Authorization code missing'}), 400

        # Exchange the authorization code for an access token
        token_data = {
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': GOOGLE_REDIRECT_URI
        }

        token_response = requests.post(GOOGLE_TOKEN_URL, data=token_data)
        token_json = token_response.json()

        if 'access_token' not in token_json:
            return jsonify({'error': 'Failed to get access token', 'details': token_json}), 400

        access_token = token_json['access_token']

        # Get user information from Google
        headers = {'Authorization': f'Bearer {access_token}'}
        userinfo_response = requests.get(GOOGLE_USERINFO_URL, headers=headers)
        userinfo = userinfo_response.json()

        if 'error' in userinfo:
            return jsonify({'error': 'Failed to get user info', 'details': userinfo}), 400

        # Store user information in the session
        session['user'] = {
            'id': userinfo.get('sub'),
            'name': userinfo.get('name'),
            'email': userinfo.get('email'),
            'picture': userinfo.get('picture')
        }

        # Redirect to a success page or return user data as JSON
        return jsonify({'message': 'Login successful', 'user': session['user']}), 200

    except Exception as e:
        return jsonify({'error': 'An error occurred during authentication', 'details': str(e)}), 500


@app.route('/auth/logout')
def logout():
    """Clear the user session."""
    session.pop('user', None)
    return jsonify({'message': 'Logged out successfully'}), 200


if __name__ == '__main__':
    app.run(debug=True)