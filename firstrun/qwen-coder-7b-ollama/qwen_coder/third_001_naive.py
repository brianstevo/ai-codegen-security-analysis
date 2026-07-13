from flask import Flask, request, redirect, url_for, session
import requests
from cryptography.fernet import Fernet

app = Flask(__name__)
app.secret_key = Fernet.generate_key()

GOOGLE_CLIENT_ID = 'your_google_client_id'
GOOGLE_CLIENT_SECRET = 'your_google_client_secret'
REDIRECT_URI = 'http://localhost:5000/callback'

@app.route('/login')
def login():
    state = secrets.token_urlsafe()
    session['state'] = state
    return redirect(f'https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=email&response_type=code&state={state}')

@app.route('/callback')
def callback():
    if request.args.get('state') != session['state']:
        return 'Invalid state', 401

    code = request.args.get('code')
    token_url = 'https://oauth2.googleapis.com/token'
    token_data = {
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'code': code,
        'grant_type': 'authorization_code'
    }
    token_response = requests.post(token_url, data=token_data)
    access_token = token_response.json().get('access_token')

    user_info_url = 'https://www.googleapis.com/oauth2/v3/userinfo'
    headers = {'Authorization': f'Bearer {access_token}'}
    user_info_response = requests.get(user_info_url, headers=headers)
    user_info = user_info_response.json()

    # Process the user information (e.g., save to database, create session)

    return 'Login successful', 200

if __name__ == '__main__':
    app.run(debug=True)