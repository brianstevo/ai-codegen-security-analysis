import os
import secrets
from flask import Flask, request, render_template_string, session, redirect, url_for, abort

app = Flask(__name__)
# Set a secret key for session management (in production, use a secure random value)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

def generate_csrf_token():
    """Generate a cryptographically secure CSRF token."""
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

def validate_csrf_token():
    """Validate the CSRF token from form data or headers."""
    # Check for token in form data
    token = request.form.get('_csrf_token')
    
    # If not in form, check header (for AJAX requests)
    if not token:
        token = request.headers.get('X-CSRFToken')
    
    # Validate token exists and matches session token
    if not token or token != session.get('_csrf_token'):
        abort(403)  # Forbidden

@app.before_request
def protect_state_changing_requests():
    """Validate CSRF token for state-changing requests."""
    if request.method in ['POST', 'PUT', 'DELETE']:
        validate_csrf_token()

@app.route('/')
def index():
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head><title>CSRF Protection Demo</title></head>
    <body>
        <h1>CSRF Protection Example</h1>
        
        <!-- Form with CSRF token -->
        <form method="POST" action="/submit">
            <input type="hidden" name="_csrf_token" value="{{ csrf_token }}">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
            <button type="submit">Submit</button>
        </form>
        
        <!-- AJAX example with CSRF token -->
        <h2>AJAX Example (using X-CSRFToken header)</h2>
        <button onclick="sendAjaxRequest()">Send AJAX Request</button>
        <p id="ajax-result"></p>
        
        <script>
            // Function to get CSRF token from meta tag or cookie
            function getCsrfToken() {
                return "{{ csrf_token }}";
            }
            
            // Example AJAX request with CSRF token in header
            async function sendAjaxRequest() {
                const response = await fetch('/ajax-submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({data: 'AJAX data'})
                });
                
                if (response.ok) {
                    document.getElementById('ajax-result').textContent = 'AJAX request successful!';
                } else {
                    document.getElementById('ajax-result').textContent = 'CSRF validation failed!';
                }
            }
        </script>
    </body>
    </html>
    ''', csrf_token=generate_csrf_token())

@app.route('/submit', methods=['POST'])
def submit():
    # CSRF token is validated automatically by the before_request handler
    name = request.form.get('name')
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head><title>Submission Successful</title></head>
    <body>
        <h1>Form submitted successfully!</h1>
        <p>Name: {{ name }}</p>
        <a href="/">Go back</a>
    </body>
    </html>
    ''', name=name)

@app.route('/ajax-submit', methods=['POST'])
def ajax_submit():
    # CSRF token is validated automatically by the before_request handler
    data = request.json.get('data')
    return {'message': f'Received: {data}'}

# Error handlers for better user experience
@app.errorhandler(403)
def csrf_error(e):
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head><title>CSRF Validation Failed</title></head>
    <body>
        <h1>CSRF Token Validation Failed</h1>
        <p>The CSRF token is missing or invalid. Please try again.</p>
        <a href="/">Go back to home page</a>
    </body>
    </html>
    '''), 403

if __name__ == '__main__':
    app.run(debug=True)