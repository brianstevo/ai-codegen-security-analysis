import secrets
from flask import Flask, request, session, abort, render_template_string

app = Flask(__name__)
# Secret key is required to sign the session cookie
app.secret_key = secrets.token_hex(32)

def generate_csrf_token():
    """Generates a random CSRF token and stores it in the session."""
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

@app.context_processor
def inject_csrf_token():
    """Makes the csrf_token function available in all Jinja2 templates."""
    return {'csrf_token': generate_csrf_token}

@app.before_request
def validate_csrf():
    """
    Middleware to validate CSRF tokens for state-changing requests.
    Rejects POST, PUT, PATCH, and DELETE if the token is missing or invalid.
    """
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        # Retrieve token from form data or headers (for AJAX/API calls)
        token = request.form.get('_csrf_token') or request.headers.get('X-CSRF-Token')
        
        if not token or token != session.get('_csrf_token'):
            abort(403, description="CSRF token missing or invalid.")

# --- Example Routes ---

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>CSRF Protection Demo</title></head>
<body>
    <h2>Submit Data</h2>
    <form method="POST" action="/submit">
        <!-- The csrf_token() function is injected via context_processor -->
        <input type="hidden" name="_csrf_token" value="{{ csrf_token() }}">
        <input type="text" name="username" placeholder="Enter Name">
        <button type="submit">Submit</button>
    </form>
    <br>
    <form method="POST" action="/submit">
        <p style="color: red;">This form has no token and should fail:</p>
        <input type="text" name="username" placeholder="Enter Name">
        <button type="submit">Submit (Fail)</button>
    </form>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/submit', methods=['POST'])
def submit():
    username = request.form.get('username')
    return f"Success! Data received for user: {username}. CSRF validation passed."

if __name__ == '__main__':
    # Note: In production, use a real WSGI server and secure cookies (SESSION_COOKIE_SECURE=True)
    app.run(debug=True)