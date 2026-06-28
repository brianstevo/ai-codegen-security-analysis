from flask import Flask, request, redirect, url_for, session, jsonify
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
REDIRECT_URI = url_for('google_callback', _external=True)

@app.route('/login/google')
def google_login():
    auth_url = f"https://accounts.google.com/o/oauth2/auth?response_type=code&client_id={GOOGLE_CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=openid%20email%20profile"
    return redirect(auth_url)

@app.route('/login/google/callback')
def google_callback():
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'Authorization code not found'}), 400

    token_data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code'
    }

    token_response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
    token_response.raise_for_status()
    token_json = token_response.json()

    id_info = id_token.verify_oauth2_token(
        token_json['id_token'],
        google_requests.Request(),
        GOOGLE_CLIENT_ID
    )

    session['user'] = {
        'email': id_info['email'],
        'name': id_info.get('name', ''),
        'picture': id_info.get('picture', '')
    }

    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect(url_for('google_login'))
    return jsonify({'message': 'Welcome to your dashboard!', 'user': session['user']})

if __name__ == '__main__':
    app.run(debug=True)