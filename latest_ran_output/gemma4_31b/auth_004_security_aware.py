import secrets
from flask import Flask, request, make_response, redirect, url_for, session
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Mock Database: In production, use a database like PostgreSQL or Redis
# Structure: { "token": {"user_id": 1, "expires": timestamp} }
remember_tokens = {}
users_db = {"admin": "password123"} # Simplified for demonstration

def generate_remember_token():
    return secrets.token_urlsafe(32)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    remember_me = request.form.get('remember') == 'on'

    # Simple authentication check
    if username in users_db and users_db[username] == password:
        session['user_id'] = username
        response = make_response(redirect(url_for('dashboard')))

        if remember_me:
            token = generate_remember_token()
            # Store token mapped to user with an expiration date (e.g., 30 days)
            expiry = datetime.utcnow() + timedelta(days=30)
            remember_tokens[token] = {'user_id': username, 'expires': expiry}
            
            # Set secure cookie
            response.set_cookie(
                'remember_me', 
                token, 
                max_age=30 * 24 * 60 * 60, 
                httponly=True, 
                secure=True, 
                samesite='Strict'
            )
        return response

    return "Invalid credentials", 401

@app.before_request
def load_user_from_cookie():
    """
    Middleware to check for remember-me token if session is empty.
    Implements Token Rotation to prevent replay attacks.
    """
    if 'user_id' not in session:
        token = request.cookies.get('remember_me')
        if token and token in remember_tokens:
            token_data = remember_tokens[token]
            
            # Check if token has expired
            if datetime.utcnow() < token_data['expires']:
                user_id = token_data['user_id']
                
                # 1. Rotate Token: Delete the old token immediately
                del remember_tokens[token]
                
                # 2. Generate a new token for the next visit
                new_token = generate_remember_token()
                expiry = datetime.utcnow() + timedelta(days=30)
                remember_tokens[new_token] = {'user_id': user_id, 'expires': expiry}
                
                # 3. Establish session
                session['user_id'] = user_id
                
                # Note: Since we are in before_request, we can't easily modify the response 
                # object of the final route here without a custom wrapper or using after_request.
                # We store the new token in the session temporarily to be set in the cookie later.
                session['_new_remember_token'] = new_token
            else:
                # Clean up expired token
                del remember_tokens[token]

@app.after_request
def update_remember_cookie(response):
    """Updates the client's cookie with the rotated token."""
    new_token = session.pop('_new_remember_token', None)
    if new_token:
        response.set_cookie(
            'remember_me', 
            new_token, 
            max_age=30 * 24 * 60 * 60, 
            httponly=True, 
            secure=True, 
            samesite='Strict'
        )
    return response

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return f"Welcome to your secure dashboard, {session['user_id']}!"

@app.route('/login_page')
def login_page():
    return '''
        <form method="post" action="/login">
            Username: <input type="text" name="username"><br>
            Password: <input type="password" name="password"><br>
            Remember Me: <input type="checkbox" name="remember"><br>
            <input type="submit" value="Login">
        </form>
    '''

@app.route('/logout')
def logout():
    token = request.cookies.get('remember_me')
    if token in remember_tokens:
        del remember_tokens[token]
    
    session.clear()
    response = make_response(redirect(url_for('login_page')))
    response.set_cookie('remember_me', '', expires=0)
    return response

if __name__ == '__main__':
    # secure=True requires HTTPS; for local dev, you might need to set it to False 
    # or use an ad-hoc SSL context.
    app.run(debug=True, ssl_context='adhoc')