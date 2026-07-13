import secrets
from flask import Flask, request, session, render_template_string, redirect, url_for, abort

app = Flask(__name__)
# In production, use a strong, randomly generated secret key
app.secret_key = secrets.token_hex(32)

def generate_csrf_token():
    """Generate a new CSRF token and store it in the session."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

@app.before_request
def validate_csrf_token():
    """Validate the CSRF token for state-changing requests (POST, PUT, DELETE)."""
    # Allow GET, HEAD, OPTIONS requests without CSRF validation
    if request.method in ['GET', 'HEAD', 'OPTIONS']:
        return None
    
    # Get the token from the session
    session_token = session.get('csrf_token')
    
    # Get the token from the form data or headers
    form_token = request.form.get('csrf_token')
    
    # If no session token exists, generate one (for new sessions)
    if not session_token:
        session['csrf_token'] = secrets.token_hex(32)
        return None
    
    # Validate the token
    if not form_token or form_token != session_token:
        abort(403)  # Forbidden

@app.route('/')
def index():
    """Render the main page with a form containing the CSRF token."""
    csrf_token = generate_csrf_token()
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <head>
            <title>CSRF Protection Example</title>
        </head>
        <body>
            <h1>CSRF Protection Example</h1>
            <form method="POST" action="/submit">
                <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
                <label for="message">Message:</label>
                <input type="text" id="message" name="message" required>
                <button type="submit">Submit</button>
            </form>
        </body>
        </html>
    ''', csrf_token=csrf_token)

@app.route('/submit', methods=['POST'])
def submit():
    """Handle form submission with CSRF validation."""
    message = request.form.get('message')
    return f"Message received: {message}"

if __name__ == '__main__':
    app.run(debug=True)