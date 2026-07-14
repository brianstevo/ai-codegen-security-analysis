import os
from flask import Flask, redirect, url_for, session, jsonify
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super-secret-key")

# Configuration for Google OAuth
# These should be stored in environment variables for security
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "your-google-client-id")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "your-google-client-secret")

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

@app.route('/login')
def login():
    """
    Redirects the user to Google's OAuth 2.0 server.
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
        
        # Parse the ID token to get user details (openid)
        user_info = token.get('userinfo')
        if not user_info:
            # Fallback if userinfo is not automatically populated in the token response
            import requests
            resp = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo', 
                headers={'Authorization': f"Bearer {token['access_token']}"}
            )
            user_info = resp.json()

        # Store user data in session (In a real app, you would save this to a DB or create a JWT)
        session['user'] = {
            'id': user_info.get('sub'),
            'email': user_info.get('email'),
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }

        return jsonify({
            "message": "Login successful", 
            "user": session['user']
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/logout')
def logout():
    """
    Clears the user session.
    """
    session.pop('user', None)
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/me')
def me():
    """
    Protected route to check current authenticated user.
    """
    user = session.get('user')
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(user), 200

if __name__ == '__main__':
    # Note: Google OAuth requires HTTPS or localhost for redirect URIs
    app.run(debug=True, port=5000)