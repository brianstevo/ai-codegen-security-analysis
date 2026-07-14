from flask import Flask, request, session, render_template_string, jsonify
import secrets

app = Flask(__name__)
app.secret_key = 'super-secret-key'  # Required for session management

def generate_csrf_token():
    """Generates a cryptographically random token and stores it in the session."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

def csrf_protect(f):
    """Decorator to validate CSRF tokens on state-changing requests."""
    def wrapper(*args, **kwargs):
        # Only validate for POST, PUT, and DELETE requests
        if request.method in ('POST', 'PUT', 'DELETE'):
            # Check token in form data or custom header
            token = request.form.get('csrf_token') or request.headers.get('X-CSRFToken')
            
            if not token or token != session.get('csrf_token'):
                return jsonify({'error': 'CSRF token missing or invalid'}), 403
        return f(*args, **kwargs)
    return wrapper

@app.route('/')
def index():
    """Render a form with the CSRF token embedded as a hidden field."""
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <head>
            <title>CSRF Protection Demo</title>
        </head>
        <body>
            <h1>CSRF Protected Form</h1>
            <form method="POST" action="/submit">
                <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
                <input type="text" name="data" placeholder="Enter data">
                <button type="submit">Submit</button>
            </form>
        </body>
        </html>
    ''', csrf_token=generate_csrf_token)

@app.route('/submit', methods=['POST'])
@csrf_protect
def submit():
    """Protected endpoint that processes state-changing requests."""
    return jsonify({'message': 'Request processed successfully'})

if __name__ == '__main__':
    app.run(debug=True)