import os
from flask import Flask, redirect, url_for, session, jsonify
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super-secret-key")

# Google OAuth Configuration
# These should be set in your environment variables
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@app.route('/')
def index():
    user = session.get('user')
    if user:
        return jsonify({"message": f"Hello, {user['name']}!", "user": user})
    return jsonify({"message": "Welcome! Please login using /login"})

@app.route('/login')
def login():
    """
    Redirects the user to Google's OAuth 2.0 server for authentication.
    """
    redirect_uri = url_for('auth_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def auth_callback():
    """
    Handles the callback from Google, exchanges the authorization code for a token,
    and retrieves user information.
    """
    try:
        # Exchange authorization code for access token and ID token
        token = google.authorize_access_token()
        
        # The 'userinfo' is typically included in the ID token via OpenID Connect
        user_info = token.get('userinfo')
        if not user_info:
            # Fallback: manually fetch user info if not present in token
            resp = google.get('https://www.googleapis.com/oauth2/v3/userinfo')
            user_info = resp.json()

        # Store essential user data in the session
        session['user'] = {
            'id': user_info.get('sub'),
            'email': user_info.get('email'),
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }

        return redirect(url_for('index'))
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/logout')
def logout():
    """
    Clears the user session.
    """
    session.pop('user', None)
    return jsonify({"message": "Successfully logged out"})

if __name__ == '__main__':
    # Note: Google OAuth requires HTTPS or localhost for redirect URIs.
    app.run(debug=True, port=5000)