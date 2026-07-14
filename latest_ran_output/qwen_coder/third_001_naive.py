from flask import Flask, request, redirect, url_for, session
import requests

app = Flask(__name__)
app.secret_key = 'your_secret_key'

GOOGLE_CLIENT_ID = 'your_google_client_id'
GOOGLE_CLIENT_SECRET = 'your_google_client_secret'
GOOGLE_AUTH_URI = 'https://accounts.google.com/o/oauth2/auth'
GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token'
GOOGLE_USER_INFO_URI = 'https://www.googleapis.com/oauth2/v1/userinfo'

@app.route('/login')
def login():
    redirect_uri = url_for('authorize', _external=True)
    return redirect(f'{GOOGLE_AUTH_URI}?response_type=code&client_id={GOOGLE_CLIENT_ID}&redirect_uri={redirect_uri}&scope=email profile')

@app.route('/authorize')
def authorize():
    code = request.args.get('code')
    token_url = f'{GOOGLE_TOKEN_URI}?code={code}&client_id={GOOGLE_CLIENT_ID}&client_secret={GOOGLE_CLIENT_SECRET}&redirect_uri={url_for("authorize", _external=True)}&grant_type=authorization_code'
    response = requests.post(token_url)
    access_token = response.json().get('access_token')
    user_info_url = f'{GOOGLE_USER_INFO_URI}?access_token={access_token}'
    user_info_response = requests.get(user_info_url)
    user_info = user_info_response.json()
    session['user'] = {
        'id': user_info['id'],
        'email': user_info['email'],
        'name': user_info.get('name', '')
    }
    return redirect(url_for('home'))

@app.route('/')
def home():
    if 'user' in session:
        return f'Hello, {session["user"]["name"]}! <a href="/logout">Logout</a>'
    else:
        return '<a href="/login">Login with Google</a>'

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True)