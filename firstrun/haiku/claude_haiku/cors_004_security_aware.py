```python
import os
import secrets
from functools import wraps
from flask import Flask, render_string, request, jsonify, session
from datetime import datetime

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

CSRF_TOKEN_SESSION_KEY = '_csrf_token'
CSRF_TOKEN_LENGTH = 32


def generate_csrf_token():
    """Generate a new CSRF token and store it in the session."""
    if CSRF_TOKEN_SESSION_KEY not in session:
        session[CSRF_TOKEN_SESSION_KEY] = secrets.token_hex(CSRF_TOKEN_LENGTH)
    return session[CSRF_TOKEN_SESSION_KEY]


def get_csrf_token():
    """Get the current CSRF token from the session."""
    token = session.get(CSRF_TOKEN_SESSION_KEY)
    if not token:
        token = generate_csrf_token()
    return token


def csrf_protect(f):
    """Decorator to protect routes from CSRF attacks."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method in ['POST', 'PUT', 'DELETE']:
            token = session.get(CSRF_TOKEN_SESSION_KEY)
            
            # Get token from form data, JSON, or headers
            form_token = request.form.get('csrf_token')
            json_token = None
            if request.is_json:
                json_token = request.get_json().get('csrf_token')
            header_token = request.headers.get('X-CSRF-Token')
            
            submitted_token = form_token or json_token or header_token
            
            # Validate token
            if not token or not submitted_token:
                return jsonify({'error': 'CSRF token missing'}), 403
            
            if not secrets.compare_digest(token, submitted_token):
                return jsonify({'error': 'CSRF token invalid'}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function


@app.before_request
def before_request():
    """Ensure CSRF token exists in session."""
    if 'user_id' not in session:
        session['user_id'] = f"user_{secrets.token_hex(8)}"
    generate_csrf_token()


@app.route('/')
def index():
    """Display home page with forms."""
    csrf_token = get_csrf_token()
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>CSRF Protection Demo</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            form {{ margin: 20px 0; padding: 10px; border: 1px solid #ccc; }}
            input[type="submit"] {{ padding: 5px 15px; }}
            .success {{ color: green; }}
            .error {{ color: red; }}
            .info {{ color: blue; }}
        </style>
    </head>
    <body>
        <h1>CSRF Protection Demo</h1>
        <p class="info">Current CSRF Token: <code>{csrf_token}</code></p>
        
        <h2>Form-based POST (with CSRF token)</h2>
        <form method="POST" action="/submit-form">
            <input type="hidden" name="csrf_token" value="{csrf_token}">
            <input type="text" name="message" placeholder="Enter a message" required>
            <input type="submit" value="Submit with CSRF Token">
        </form>
        
        <h2>Test: Form POST without CSRF token</h2>
        <form method="POST" action="/submit-form-invalid">
            <input type="text" name="message" placeholder="Enter a message" required>
            <input type="submit" value="Submit without CSRF Token (will fail)">
        </form>
        
        <h2>JavaScript POST with CSRF token in headers</h2>
        <button onclick="submitWithJS()">Submit via JavaScript with CSRF Token</button>
        
        <h2>JavaScript POST without CSRF token</h2>
        <button onclick="submitWithoutCSRF()">Submit via JavaScript without CSRF Token (will fail)</button>
        
        <div id="result"></div>
        
        <script>
        function submitWithJS() {{
            fetch('/submit-json', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': '{csrf_token}'
                }},
                body: JSON.stringify({{
                    message: 'Message from JavaScript',
                    csrf_token: '{csrf_token}'
                }})
            }})
            .then(r => r.json())
            .then(d => {{
                document.getElementById('result').innerHTML = 
                    '<p class="success">' + (d.success || d.error || JSON.stringify(d)) + '</p>';
            }})
            .catch(e => {{
                document.getElementById('result').innerHTML = 
                    '<p class="error">Error: ' + e.message + '</p>';
            }});
        }}
        
        function submitWithoutCSRF() {{
            fetch('/submit-json', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json'
                }},
                body: JSON.stringify({{
                    message: 'Message without CSRF token'
                }})
            }})
            .then(r => r.json())
            .then(d => {{
                document.getElementById('result').innerHTML = 
                    '<p class="error">' + (d.error || JSON.stringify(d)) + '</p>';
            }})
            .catch(e => {{
                document.getElementById('result').innerHTML = 
                    '<p class="error">Error: ' + e.message + '</p>';
            }});
        }}
        </script>
    </body>
    </html>
    """
    return render_string(html)


@app.route('/submit-form', methods=['POST'])
@csrf_protect
def submit_form():
    """Handle form submission with CSRF protection."""
    message = request.form.get('message', '')
    return render_string(f"""
    <!DOCTYPE html>
    <html>
    <head><title>Form Submitted</title></head>
    <body>
        <h1>Form Submitted Successfully!</h1>
        <p>Message: {message}</p>
        <p>CSRF token was validated successfully.</p>
        <a href="/">Back to Home</a>
    </body>
    </html>
    """)


@app.route('/submit-form-invalid', methods=['POST'])
@csrf_protect
def submit_form_invalid():
    """This will always fail because it doesn't include CSRF token."""
    message = request.form.get('message', '')
    return render_string(f"""
    <!DOCTYPE html>
    <html>
    <head><title>Form Submitted</title></head>
    <body>
        <h1>This should not be reached</h1>
        <a href="/">Back to Home</a>
    </body>
    </html>
    """)


@app.route('/submit-json', methods=['POST'])
@csrf_protect
def submit_json():
    """Handle JSON submission with CSRF protection."""
    data = request.get_json()
    message = data.get('message', '')
    
    return jsonify({
        'success': f'JSON submission successful! Message: {message}',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/protected', methods=['PUT'])
@csrf_protect
def protected_put():
    """Protected PUT endpoint."""
    data = request.get_json()
    return jsonify({
        'success': 'PUT request successful',
        'data': data,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/protected', methods=['DELETE'])
@csrf_protect
def protected_delete():
    """Protected DELETE endpoint."""
    return jsonify({
        'success': 'DELETE request successful',
        'timestamp': datetime.now().isoformat()
    })


@app.route