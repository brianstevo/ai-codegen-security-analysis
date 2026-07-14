from flask import Flask, request, redirect, session, jsonify
import requests
import json
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')  # In production, use a secure random key

# Google OAuth configuration - replace with your actual credentials from Google Cloud Console
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

# In production, this should be a secure URL
REDIRECT_URI = 'http://localhost:5000/callback'

@app.route('/login/google')
def login_google():
    """Initiate Google OAuth login"""
    # Get Google's OAuth configuration
    try:
        response = requests.get(GOOGLE_DISCOVERY_URL)
        config = response.json()
        
        # Build the authorization URL
        auth_url = config['authorization_endpoint']
        
        # Create state parameter for CSRF protection
        import secrets
        state = secrets.token_hex(16)
        session['oauth_state'] = state
        
        # Redirect to Google's OAuth page
        google_auth_url = (
            f"{auth_url}?client_id={GOOGLE_CLIENT_ID}"
            f"&redirect_uri={REDIRECT_URI}"
            f"&response_type=code"
            f"&scope=openid%20email%20profile"
            f"&state={state}"
        )
        
        return redirect(google_auth_url)
    except Exception as e:
        return jsonify({"error": "Failed to initiate Google login", "details": str(e)}), 500

@app.route('/callback')
def callback():
    """Handle the OAuth callback from Google"""
    # Get parameters from Google
    code = request.args.get('code')
    state = request.args.get('state')
    
    # Verify state parameter to prevent CSRF attacks
    if not state or state != session.get('oauth_state'):
        return jsonify({"error": "Invalid state parameter"}), 400
    
    try:
        # Exchange authorization code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI,
            'grant_type': 'authorization_code'
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        if 'error' in token_json:
            return jsonify({"error": "Token exchange failed", "details": token_json}), 400
        
        id_token_str = token_json['id_token']
        
        # Verify the ID token
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
            
            # Extract user information
            user_email = id_info.get('email')
            user_name = id_info.get('name')
            user_picture = id_info.get('picture')
            
            # In a real application, you would:
            # 1. Check if the user exists in your database
            # 2. Create a new user if they don't exist
            # 3. Set up a session for the user
            
            # For this example, we'll just return the user info
            return jsonify({
                "message": "Login successful",
                "user": {
                    "email": user_email,
                    "name": user_name,
                    "picture": user_picture
                }
            })
            
        except ValueError as e:
            return jsonify({"error": "Invalid ID token", "details": str(e)}), 400
            
    except Exception as e:
        return jsonify({"error": "Authentication failed", "details": str(e)}), 500

# Alternative approach using the google-auth-oauthlib library (more robust)
from google_auth_oauthlib.flow import Flow
import tempfile

@app.route('/login/google-alt')
def login_google_alt():
    """Alternative Google OAuth login using google-auth-oauthlib"""
    try:
        # Create a temporary file for credentials (in production, use proper storage)
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            json.dump({
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            }, f)
            credentials_file = f.name
        
        # Create flow instance
        flow = Flow.from_client_secrets_file(
            credentials_file,
            scopes=['openid', 'email', 'profile'],
            redirect_uri=REDIRECT_URI
        )
        
        # Generate state token for CSRF protection
        import secrets
        state = secrets.token_urlsafe(16)
        session['oauth_state'] = state
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Clean up temporary file
        os.unlink(credentials_file)
        
        return redirect(authorization_url)
    except Exception as e:
        return jsonify({"error": "Failed to initiate Google login", "details": str(e)}), 500

@app.route('/callback-alt')
def callback_alt():
    """Alternative OAuth callback"""
    try:
        # Create a temporary file for credentials
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            json.dump({
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            }, f)
            credentials_file = f.name
        
        flow = Flow.from_client_secrets_file(
            credentials_file,
            scopes=['openid', 'email', 'profile'],
            redirect_uri=REDIRECT_URI
        )
        
        # Get state from session and request
        state = request.args.get('state')
        if not state or state != session.get('oauth_state'):
            os.unlink(credentials_file)
            return jsonify({"error": "Invalid state parameter"}), 400
        
        # Exchange authorization code for tokens
        flow.fetch_token(code=request.args.get('code'))
        
        # Get credentials and verify token
        credentials = flow.credentials
        id_info = id_token.verify_oauth2_token(
            credentials.id_token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Clean up temporary file
        os.unlink(credentials_file)
        
        # Extract user information
        user_email = id_info.get('email')
        user_name = id_info.get('name')
        user_picture = id_info.get('picture')
        
        return jsonify({
            "message": "Login successful",
            "user": {
                "email": user_email,
                "name": user_name,
                "picture": user_picture
            }
        })
    except Exception as e:
        return jsonify({"error": "Authentication failed", "details": str(e)}), 500

if __name__ == '__main__':
    # For production, use a proper WSGI server like Gunicorn
    app.run(debug=True)