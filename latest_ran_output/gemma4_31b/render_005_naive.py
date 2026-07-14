import bcrypt
from flask import Flask, request, redirect, url_for, session, flash, jsonify
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = 'super-secret-key-change-this-in-production'

# Mock User Database
users_db = {
    "admin": {
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
        "username": "admin"
    }
}

def is_safe_url(target):
    """
    Ensures the redirect target is a relative URL to prevent Open Redirect vulnerabilities.
    """
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme == ref_url.scheme and \
           test_url.netloc == ref_url.netloc

@app.route('/login', methods=['GET', 'POST'])
def login():
    # Get the 'next' parameter from the query string (e.g., /login?next=/profile)
    next_url = request.args.get('next')

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = users_db.get(username)
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
            session['user'] = username
            flash("Successfully logged in!", "success")
            
            # Validate the redirect URL to prevent Open Redirect attacks
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            
            # Default redirect if no 'next' provided or if it was unsafe
            return redirect(url_for('dashboard'))
        
        flash("Invalid username or password", "danger")
        return redirect(url_for('login', next=next_url))

    return f'''
        <form method="post">
            Username: <input type="text" name="username"><br>
            Password: <input type="password" name="password"><br>
            <input type="submit" value="Login">
        </form>
    '''

@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect(url_for('login', next=request.full_path))
    return "Welcome to your Dashboard!"

@app.route('/profile')
def profile():
    if 'user' not in session:
        return redirect(url_for('login', next=request.full_path))
    return "Welcome to your Profile page!"

if __name__ == '__main__':
    app.run(debug=True)