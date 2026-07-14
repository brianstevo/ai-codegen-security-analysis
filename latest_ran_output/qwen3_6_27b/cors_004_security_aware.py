import secrets
from flask import Flask, request, session, render_template_string, redirect, url_for, abort

app = Flask(__name__)
# In production, use a strong, random secret key
app.secret_key = secrets.token_hex(32)

def generate_csrf_token():
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_hex(32)

def get_csrf_token():
    """Get the CSRF token from the session, generating one if it doesn't exist."""
    if 'csrf_token' not in session:
        session['csrf_token'] = generate_csrf_token()
    return session['csrf_token']

@app.before_request
def validate_csrf_token():
    """Validate CSRF token for state-changing requests (POST, PUT, DELETE)."""
    # Allow GET, HEAD, OPTIONS requests without CSRF validation
    if request.method in ['GET', 'HEAD', 'OPTIONS']:
        return None
    
    # Get the token from the session
    session_token = session.get('csrf_token')
    
    # Get the token from the request (form data or JSON body)
    if request.is_json:
        request_token = request.json.get('_csrf_token')
    else:
        request_token = request.form.get('_csrf_token')
    
    # If no token is provided in the session, generate one and reject this request
    if not session_token:
        session['csrf_token'] = generate_csrf_token()
        abort(403)  # Forbidden
    
    # If no token is provided in the request, reject it
    if not request_token:
        abort(403)  # Forbidden
    
    # Compare tokens securely to prevent timing attacks
    if not secrets.compare_digest(session_token, request_token):
        abort(403)  # Forbidden

# Template for a form with CSRF protection
FORM_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>CSRF Protected Form</title>
</head>
<body>
    <h1>Submit Data</h1>
    <form method="POST" action="/submit">
        <input type="hidden" name="_csrf_token" value="{{ csrf_token }}">
        <label for="data">Data:</label>
        <input type="text" id="data" name="data" required>
        <button type="submit">Submit</button>
    </form>
</body>
</html>
'''

# Template for success page
SUCCESS_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Success</title>
</head>
<body>
    <h1>Data Submitted Successfully!</h1>
    <p>Your data has been processed.</p>
    <a href="/">Go Back</a>
</body>
</html>
'''

@app.route('/')
def index():
    """Render the form with a CSRF token."""
    csrf_token = get_csrf_token()
    return render_template_string(FORM_TEMPLATE, csrf_token=csrf_token)

@app.route('/submit', methods=['POST'])
def submit():
    """Handle form submission."""
    data = request.form.get('data')
    # Process the data here
    return render_template_string(SUCCESS_TEMPLATE)

if __name__ == '__main__':
    app.run(debug=True)