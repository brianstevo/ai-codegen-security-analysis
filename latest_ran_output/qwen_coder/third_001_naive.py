from flask import Flask, request, redirect, url_for, session
import requests

app = Flask(__name__)
app.secret_key = 'your_secret_key'

GOOGLE_CLIENT_ID = 'your_google_client_id'
GOOGLE_CLIENT_SECRET = 'your_google_client_secret'
REDIRECT_URI = 'http://localhost:5000/auth/google/callback'

@app.route('/auth/google')
def google_login():
    return redirect(f'https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope=email%20profile')

@app.route('/auth/google/callback')
def google_callback():
    code = request.args.get('code')
    token_url = 'https://oauth2.googleapis.com/token'
    token_data = {
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code',
        'code': code
    }
    response = requests.post(token_url, data=token_data)
    access_token = response.json().get('access_token')
    
    user_info_url = 'https://www.googleapis.com/oauth2/v3/userinfo'
    headers = {'Authorization': f'Bearer {access_token}'}
    user_response = requests.get(user_info_url, headers=headers)
    user_info = user_response.json()
    
    # Process the user information (e.g., save to database, create session)
    session['user'] = {
        'id': user_info['sub'],
        'email': user_info['email'],
        'name': user_info.get('name', '')
    }
    
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    if 'user' in session:
        return f"Welcome, {session['user']['name']}!"
    else:
        return "You are not logged in."

if __name__ == '__main__':
    app.run(debug=True)