import os
import requests
from flask import Flask, request, redirect, session, jsonify
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-secret-key')  # In production, use a secure random key

# Google OAuth configuration - get these from Google Cloud Console
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:5000/callback')

# In a real application, you would have a database to store users
users_db = {}

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login')
def login():
    """Redirect user to Google's OAuth consent screen"""
    # Construct the authorization URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        "?client_id={}"
        "&redirect_uri={}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
    ).format(GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI)
    
    return redirect(auth_url)

@app.route('/callback')
def callback():
    """Handle Google's OAuth response"""
    # Get the authorization code from the query parameters
    code = request.args.get('code')
    
    if not code:
        return jsonify({'error': 'Authorization code not received'}), 400
    
    try:
        # Exchange the authorization code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        if 'error' in token_json:
            return jsonify({'error': f"Token exchange failed: {token_json.get('error')}"}), 400
        
        id_token_str = token_json['id_token']
        
        # Verify the ID token
        try:
            # Specify the CLIENT_ID of the app that accesses the backend
            id_info = id_token.verify_oauth2_token(
                id_token_str, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
            
            # Extract user information from the verified token
            user_email = id_info['email']
            user_name = id_info.get('name', '')
            user_picture = id_info.get('picture', '')
            
            # Create or retrieve user in database (simplified example)
            if user_email not in users_db:
                users_db[user_email] = {
                    'name': user_name,
                    'email': user_email,
                    'picture': user_picture
                }
            
            # Store user info in session
            session['user'] = users_db[user_email]
            
            # Redirect to a protected page or return success
            return redirect('/dashboard')
        except ValueError as e:
            # Invalid token
            return jsonify({'error': f"Invalid ID token: {str(e)}"}), 400
            
    except Exception as e:
        return jsonify({'error': f"Authentication failed: {str(e)}"}), 500

@app.route('/dashboard')
@login_required
def dashboard():
    """Protected route that requires authentication"""
    user = session['user']
    return f"<h1>Welcome, {user['name']}!</h1><p>Email: {user['email']}</p>"

@app.route('/logout')
def logout():
    """Logout the current user"""
    session.pop('user', None)
    return redirect('/')

@app.route('/api/user')
@login_required
def get_user_info():
    """API endpoint to get current user info"""
    return jsonify(session['user'])

if __name__ == '__main__':
    # For production, you should use environment variables for all sensitive data
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        print("Warning: Google OAuth credentials are not set. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    
    app.run(debug=True)