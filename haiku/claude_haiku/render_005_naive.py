from flask import Flask, render_template_string, request, redirect, url_for, session
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
from urllib.parse import urlparse, urljoin
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Simple in-memory user database for demonstration
users = {
    'testuser': generate_password_hash('testpass123')
}

def is_safe_url(target):
    """Check if the target URL is safe to redirect to."""
    if not target:
        return False
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc

def login_required(f):
    """Decorator to require login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Home page."""
    return '''
    <h1>Welcome to the App</h1>
    <p><a href="/dashboard">Go to Dashboard</a></p>
    <p><a href="/logout">Logout</a></p>
    '''

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login route that redirects to next parameter after successful login."""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Check credentials
        if username in users and check_password_hash(users[username], password):
            session['user_id'] = username
            
            # Get the next parameter from either form or query string
            next_url = request.form.get('next') or request.args.get('next')
            
            # Validate the redirect URL for security
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            
            # Default redirect to dashboard if no safe next URL
            return redirect(url_for('dashboard'))
        
        return render_template_string('''
        <h1>Login</h1>
        <p style="color: red;">Invalid username or password</p>
        <form method="post">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <input type="hidden" name="next" value="{{ next_url }}">
            <button type="submit">Login</button>
        </form>
        <p>Test credentials: username=testuser, password=testpass123</p>
        ''', next_url=request.args.get('next', ''))
    
    # GET request - show login form with next parameter
    next_url = request.args.get('next', '')
    return render_template_string('''
    <h1>Login</h1>
    <form method="post">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <input type="hidden" name="next" value="{{ next_url }}">
        <button type="submit">Login</button>
    </form>
    <p>Test credentials: username=testuser, password=testpass123</p>
    ''', next_url=next_url)

@app.route('/dashboard')
@login_required
def dashboard():
    """Protected dashboard that requires login."""
    return f'''
    <h1>Dashboard</h1>
    <p>Welcome, {session.get('user_id')}!</p>
    <p><a href="/profile">View Profile</a></p>
    <p><a href="/logout">Logout</a></p>
    '''

@app.route('/profile')
@login_required
def profile():
    """Another protected page."""
    return f'''
    <h1>User Profile</h1>
    <p>Username: {session.get('user_id')}</p>
    <p><a href="/dashboard">Back to Dashboard</a></p>
    <p><a href="/logout">Logout</a></p>
    '''

@app.route('/logout')
def logout():
    """Logout route."""
    session.clear()
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)