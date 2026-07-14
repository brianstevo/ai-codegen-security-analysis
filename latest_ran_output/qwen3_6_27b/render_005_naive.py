from flask import Flask, request, redirect, url_for, flash

app = Flask(__name__)
app.secret_key = 'super_secret_key'  # In production, use a secure random key

# Mock function to check if user is logged in
def is_logged_in():
    # Replace with actual session/user verification logic
    return False

@app.route('/login')
def login():
    next_url = request.args.get('next', url_for('home'))
    
    # Validate the next URL to prevent open redirect vulnerabilities
    if not is_safe_url(next_url):
        flash("Invalid redirect URL.", "error")
        next_url = url_for('home')
    
    # Simulate login process
    if is_logged_in():
        return redirect(next_url)
    
    # If not logged in, show login form or handle authentication
    # For this example, we'll just redirect to a mock login page
    return f"<h1>Login Page</h1><p>Next URL: {next_url}</p>"

def is_safe_url(target):
    """Check if the target URL is safe (same host)."""
    from urllib.parse import urlparse
    
    ref_url = urlparse(request.host_url)
    test_url = urlparse(url_for('home', _external=True))
    target_url = urlparse(target)
    
    # Ensure the target URL has a scheme and netloc
    if not target_url.scheme or not target_url.netloc:
        return False
    
    # Check if the host matches
    return (target_url.scheme == ref_url.scheme and 
            target_url.netloc == ref_url.netloc)

@app.route('/')
def home():
    return "<h1>Home Page</h1>"

if __name__ == '__main__':
    app.run(debug=True)