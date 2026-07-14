from flask import Flask, request, redirect, url_for, session
import re

app = Flask(__name__)
app.secret_key = 'your_secret_key'

# Whitelist of trusted domains (without http/https)
TRUSTED_DOMAINS = ['example.com', 'sub.example.com']

@app.route('/login')
def login():
    # Simulate user authentication
    if request.form.get('username') == 'admin' and request.form.get('password') == 'password':
        session['logged_in'] = True
        return_to = request.args.get('returnTo')
        if validate_redirect_target(return_to):
            return redirect(return_to)
        else:
            return "Invalid redirect target", 403
    return "Login failed"

def validate_redirect_target(target):
    # Check for absolute URL with http/https
    if re.match(r'https?://', target):
        return False
    
    # Check for relative path
    if target.startswith('/'):
        return True
    
    # Check for trusted domain
    parsed_url = re.match(r'^([^/?#]+)', target)
    if parsed_url and parsed_url.group(1) in TRUSTED_DOMAINS:
        return True
    
    return False

if __name__ == '__main__':
    app.run(debug=True)