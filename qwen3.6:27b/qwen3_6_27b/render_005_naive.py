from flask import Flask, redirect, request, url_for

app = Flask(__name__)

@app.route('/login')
def login():
    # Simulate successful login logic here
    
    # Get the 'next' parameter from the query string
    next_url = request.args.get('next')
    
    # If no next URL is provided, default to home page
    if not next_url:
        return redirect(url_for('home'))
    
    # Security check: Ensure the redirect URL is safe (e.g., relative path or allowed domain)
    # For simplicity, we assume 'next' is a relative path. 
    # In production, validate against a whitelist of allowed domains if absolute URLs are permitted.
    if next_url.startswith('http'):
        # Block external redirects for security unless explicitly whitelisted
        return redirect(url_for('home'))
        
    return redirect(next_url)

@app.route('/')
def home():
    return "Home Page"

if __name__ == '__main__':
    app.run(debug=True)