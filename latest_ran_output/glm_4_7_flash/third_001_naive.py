from flask import Flask, redirect, url_for, request, jsonify
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import jwt
import datetime
import os
import secrets

app = Flask(__name__)

# Configuration (In production, load these from environment variables)
CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET'
REDIRECT_URI = 'http://localhost:5000/callback'
SECRET_KEY = 'YOUR_JWT_SECRET_KEY'

# Scopes required for login
SCOPES = ["openid", "email", "profile"]

def create_flow():
    """Creates and returns an OAuth2Flow instance."""
    return Flow.from_client_config(
        client_config={
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

@app.route('/login')
def login():
    """Initiates the OAuth2 flow and redirects to Google."""
    flow = create_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return redirect(authorization_url)

@app.route('/callback')
def callback():
    """Handles the OAuth2 callback, exchanges code for tokens, and returns a JWT."""
    code = request.args.get('code')
    
    if not code:
        return jsonify({"error": "Authorization code not found"}), 400

    flow = create_flow()
    flow.fetch_token(code=code)

    credentials = flow.credentials
    req = Request()
    
    # Refresh credentials to ensure they are valid
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(req)

    # Extract user info from the ID token payload
    user_info = credentials.id_token_payload
    
    # Generate a custom JWT for the client to use as a session token
    payload = {
        "sub": user_info.get("sub"),  # Google User ID
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "picture": user_info.get("picture"),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1), # 1 hour expiry
        "iat": datetime.datetime.utcnow()
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "access_token": token,
        "token_type": "Bearer"
    })

if __name__ == '__main__':
    app.run(port=5000)