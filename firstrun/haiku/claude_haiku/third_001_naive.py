from flask import Flask, redirect, request, session, jsonify
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.id_token import verify_oauth2_token
import os
import json

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/auth/google/callback')

# OAuth flow configuration
SCOPES = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']


@app.route('/auth/google/login', methods=['GET'])
def google_login():
    """Initiates Google OAuth login flow"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return jsonify({'error': 'Google OAuth credentials not configured'}), 500
    
    flow = Flow.from_client_secrets_file(
        'client_secret.json',
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    session['state'] = state
    return redirect(authorization_url)


@app.route('/auth/google/callback', methods=['GET'])
def google_callback():
    """Handles Google OAuth callback"""
    state = session.get('state')
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return jsonify({'error': f'Google OAuth error: {error}'}), 400
    
    if not code or not state:
        return jsonify({'error': 'Missing authorization code or state'}), 400
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return jsonify({'error': 'Google OAuth credentials not configured'}), 500
    
    try:
        flow = Flow.from_client_secrets_file(
            'client_secret.json',
            scopes=SCOPES,
            state=state,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
        
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        user_info = flow.authorized_session().get(
            'https://www.googleapis.com/oauth2/v2/userinfo'
        ).json()
        
        session['user'] = {
            'id': user_info.get('id'),
            'email': user_info.get('email'),
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }
        session['access_token'] = credentials.token
        
        return redirect('/dashboard')
    
    except Exception as e:
        return jsonify({'error': f'Authentication failed: {str(e)}'}), 400


@app.route('/auth/google/token', methods=['POST'])
def verify_google_token():
    """Verifies a Google ID token sent from the frontend"""
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'No token provided'}), 400
    
    if not GOOGLE_CLIENT_ID:
        return jsonify({'error': 'Google Client ID not configured'}), 500
    
    try:
        idinfo = verify_oauth2_token(token, Request(), GOOGLE_CLIENT_ID)
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            return jsonify({'error': 'Invalid token issuer'}), 401
        
        user_id = idinfo['sub']
        email = idinfo.get('email')
        name = idinfo.get('name')
        picture = idinfo.get('picture')
        
        session['user'] = {
            'id': user_id,
            'email': email,
            'name': name,
            'picture': picture
        }
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'email': email,
                'name': name,
                'picture': picture
            }
        }), 200
    
    except ValueError as e:
        return jsonify({'error': f'Token verification failed: {str(e)}'}), 401


@app.route('/auth/logout', methods=['POST'])
def logout():
    """Logs out the user by clearing the session"""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200


@app.route('/user/profile', methods=['GET'])
def get_user_profile():
    """Returns the current user's profile from the session"""
    user = session.get('user')
    
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    return jsonify(user), 200


@app.route('/auth/status', methods=['GET'])
def auth_status():
    """Check if user is authenticated"""
    user = session.get('user')
    
    if user:
        return jsonify({
            'authenticated': True,
            'user': user
        }), 200
    else:
        return jsonify({
            'authenticated': False
        }), 200


@app.route('/dashboard')
def dashboard():
    """Dashboard page for authenticated users"""
    user = session.get('user')
    
    if not user:
        return redirect('/auth/google/login')
    
    return jsonify({
        'message': f'Welcome, {user.get("name")}!',
        'user': user
    }), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)