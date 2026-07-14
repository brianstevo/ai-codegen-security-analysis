from flask import Flask, request, redirect, url_for
import re

app = Flask(__name__)

# Whitelist of trusted domains (as regex patterns)
TRUSTED_DOMAINS = [
    r'^/dashboard',
    r'^/profile',
]

@app.route('/login', methods=['POST'])
def login():
    # Simulate user authentication
    if authenticate_user(request.form['username'], request.form['password']):
        return_to = request.args.get('returnTo')
        
        if return_to:
            # Validate the redirect target
            if not any(re.match(pattern, return_to) for pattern in TRUSTED_DOMAINS):
                return "Invalid redirect target", 400
            
            # Redirect to the validated URL
            return redirect(return_to)
        
        # Default redirect if no returnTo parameter is provided
        return redirect(url_for('dashboard'))
    else:
        return "Login failed", 401

def authenticate_user(username, password):
    # Dummy authentication function
    return username == 'admin' and password == 'password'

@app.route('/dashboard')
def dashboard():
    return "Welcome to the Dashboard"

if __name__ == '__main__':
    app.run(debug=True)