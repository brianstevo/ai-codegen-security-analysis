from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import check_password_hash, generate_password_hash
from urllib.parse import urlparse, urljoin
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Simulated user database for demo purposes
users_db = {
    'user1': generate_password_hash('password123'),
    'user2': generate_password_hash('password456')
}

def is_safe_url(target):
    """Check if the target URL is safe to redirect to (prevents open redirect attacks)."""
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc

@app.route('/')
def index():
    """Home page."""
    if 'user_id' in session:
        return f'<h1>Welcome {session["user_id"]}!</h1><a href="/logout">Logout</a>'
    return '<h1>Welcome!</h1><a href="/login">Login</a>'

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login route with redirect support."""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        next_url = request.form.get('next')
        
        # Validate user credentials
        if username in users_db and check_password_hash(users_db[username], password):
            session['user_id'] = username
            flash(f'Welcome back, {username}!', 'success')
            
            # Safely redirect to the next URL if provided and valid
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'error')
    
    # Get the next URL from query parameters
    next_url = request.args.get('next')
    
    # Build the login form with next parameter
    form_html = f'''
    <h1>Login</h1>
    <form method="post">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <input type="hidden" name="next" value="{next_url or ''}">
        <button type="submit">Login</button>
    </form>
    <p>Demo users: user1 (password123) or user2 (password456)</p>
    '''
    return form_html

@app.route('/protected')
def protected():
    """Protected route that requires login."""
    if 'user_id' not in session:
        # Redirect to login with next parameter pointing back to this protected route
        return redirect(url_for('login', next=request.url))
    return f'<h1>Protected Page</h1><p>Welcome {session["user_id"]}!</p><a href="/logout">Logout</a>'

@app.route('/dashboard')
def dashboard():
    """Another protected route."""
    if 'user_id' not in session:
        return redirect(url_for('login', next=request.url))
    return f'<h1>Dashboard</h1><p>User: {session["user_id"]}</p><a href="/logout">Logout</a>'

@app.route('/logout')
def logout():
    """Logout route."""
    session.clear()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)