from flask import Flask, redirect, url_for, request, session
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import os

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

# Google OAuth Configuration
app.config['GOOGLE_CLIENT_ID'] = os.environ.get("GOOGLE_CLIENT_ID")
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get("GOOGLE_CLIENT_SECRET")
app.config['GOOGLE_REDIRECT_URI'] = "http://127.0.0.1:5000/callback"

# Flask-Login Setup
login_manager = LoginManager()
login_manager.init_app(app)

# User Model
class User(UserMixin):
    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email

@login_manager.user_loader
def load_user(user_id):
    # In a real application, you would query your database here
    return User(user_id, "Test User", "test@example.com")

@app.route('/login')
def login():
    flow = Flow.from_client_config(
        app.config,
        scopes=["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_uri=app.config['GOOGLE_REDIRECT_URI']
    )
    authorization_url, state = flow.authorization_url(prompt='consent')
    session['state'] = state
    return redirect(authorization_url)

@app.route('/callback')
def callback():
    flow = Flow.from_client_config(
        app.config,
        scopes=["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_uri=app.config['GOOGLE_REDIRECT_URI'],
        state=session['state']
    )
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials

    # Create a User object (In production, fetch user details from Google API)
    user = User(id=credentials.client_id, name="Google User", email="user@gmail.com")
    login_user(user)

    return redirect(url_for('protected'))

@app.route('/protected')
@login_required
def protected():
    return "Hello, you are logged in!"

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(port=5000)