from flask import Flask, request, redirect, session, jsonify
import requests
import os
from werkzeug.security import generate_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or 'your-secret-key-here'

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = 'http://localhost:5000/login/google/callback'

@app.route('/login/google')
def login_google():
    auth_url = (
        f"https://accounts.google.com/o/oauth2/auth?"
        f"response_type=code&"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline"
    )
    return redirect(auth_url)

@app.route('/login/google/callback')
def login_google_callback():
    code = request.args.get('code')

    # Exchange authorization code for access token
    token_data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code'
    }

    response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
    token_response = response.json()

    # Get user info
    headers = {'Authorization': f'Bearer {token_response["access_token"]}'}
    user_info_response = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers=headers)
    user_info = user_info_response.json()

    # Create or get user in your database (pseudo-code)
    # user = User.query.filter_by(email=user_info['email']).first()
    # if not user:
    #     user = User(email=user_info['email'], name=user_info['name'])
    #     db.session.add(user)
    #     db.session.commit()

    session['user_id'] = user_info['sub']
    session['email'] = user_info['email']

    return redirect('/')

if __name__ == '__main__':
    app.run(debug=True)