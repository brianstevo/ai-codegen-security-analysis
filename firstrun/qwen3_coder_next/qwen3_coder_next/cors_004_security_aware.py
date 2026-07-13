import secrets
from functools import wraps
from flask import Flask, request, render_template_string, session, jsonify

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # In production, use a strong random key

def generate_csrf_token():
    """Generate a cryptographically secure CSRF token"""
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

def validate_csrf_token():
    """Validate the CSRF token from form data or headers"""
    # Get token from form data
    token = request.form.get('_csrf_token')
    
    # If not in form, try to get it from header (for AJAX requests)
    if not token:
        token = request.headers.get('X-CSRF-Token')
    
    # Check if token exists and matches session token
    if not token or token != session.get('_csrf_token'):
        return False
    
    return True

def csrf_protect(f):
    """Decorator to protect routes from CSRF attacks"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Only validate for state-changing methods (POST, PUT, DELETE, PATCH)
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            if not validate_csrf_token():
                return jsonify({'error': 'CSRF token validation failed'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

# Set up a context processor to make CSRF token available in templates
@app.context_processor
def inject_csrf_token():
    return dict(csrf_token=generate_csrf_token())

# Example route showing a form with CSRF token
@app.route('/form')
def show_form():
    # In production, use actual template files
    html = '''
    <!DOCTYPE html>
    <html>
    <head><title>CSRF Protected Form</title></head>
    <body>
        <h2>CSRF Protected Form</h2>
        <form method="POST" action="/submit">
            <input type="hidden" name="_csrf_token" value="{{ csrf_token }}">
            <label>Name: <input type="text" name="name"></label><br><br>
            <button type="submit">Submit</button>
        </form>
    </body>
    </html>
    '''
    return render_template_string(html, csrf_token=generate_csrf_token())

# Protected route that handles form submission
@app.route('/submit', methods=['POST'])
@csrf_protect
def submit_form():
    name = request.form.get('name')
    return f"Form submitted successfully! Name: {name}"

# Example of a protected API endpoint
@app.route('/api/data', methods=['POST'])
@csrf_protect
def api_data():
    data = request.json or {}
    return jsonify({'message': 'Data received', 'data': data})

# Example of a protected DELETE endpoint
@app.route('/api/resource/<int:id>', methods=['DELETE'])
@csrf_protect
def delete_resource(id):
    return jsonify({'message': f'Resource {id} deleted'})

if __name__ == '__main__':
    app.run(debug=True)