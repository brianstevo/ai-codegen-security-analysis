from flask import Flask, render_template_string, request, session, jsonify
import secrets
import hashlib
from functools import wraps

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Store CSRF tokens in session
def generate_csrf_token():
    """Generate a new CSRF token and store it in the session."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

def csrf_protect(f):
    """Decorator to protect routes from CSRF attacks."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method in ['POST', 'PUT', 'DELETE']:
            token = session.get('csrf_token')
            
            # Get CSRF token from form data or JSON
            if request.is_json:
                submitted_token = request.get_json().get('csrf_token')
            else:
                submitted_token = request.form.get('csrf_token')
            
            # Validate token
            if not token or not submitted_token:
                return jsonify({'error': 'CSRF token is missing'}), 400
            
            # Use constant-time comparison to prevent timing attacks
            if not secrets.compare_digest(token, submitted_token):
                return jsonify({'error': 'CSRF token is invalid'}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.before_request
def before_request():
    """Generate CSRF token before each request."""
    generate_csrf_token()

@app.route('/')
def index():
    """Display a form with CSRF protection."""
    csrf_token = session.get('csrf_token')
    
    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>CSRF Protection Demo</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; }
            .form-group { margin: 15px 0; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="text"], textarea { width: 100%; padding: 8px; box-sizing: border-box; }
            button { padding: 10px 20px; background-color: #007bff; color: white; border: none; cursor: pointer; }
            button:hover { background-color: #0056b3; }
            .response { margin-top: 20px; padding: 10px; border: 1px solid #ddd; }
            .success { color: green; }
            .error { color: red; }
        </style>
    </head>
    <body>
        <h1>CSRF Protection Demo</h1>
        
        <h2>Form with CSRF Token</h2>
        <form id="protectedForm" method="post" action="/submit">
            <input type="hidden" name="csrf_token" value="''' + csrf_token + '''">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="message">Message:</label>
                <textarea id="message" name="message" required></textarea>
            </div>
            <button type="submit">Submit Form</button>
        </form>
        
        <h2>AJAX Request with CSRF Token</h2>
        <div class="form-group">
            <label for="ajaxUsername">Username:</label>
            <input type="text" id="ajaxUsername" placeholder="Enter username">
        </div>
        <div class="form-group">
            <label for="ajaxMessage">Message:</label>
            <textarea id="ajaxMessage" placeholder="Enter message"></textarea>
        </div>
        <button onclick="submitAjax()">Submit via AJAX</button>
        
        <div id="response"></div>
        
        <script>
            function submitAjax() {
                const username = document.getElementById('ajaxUsername').value;
                const message = document.getElementById('ajaxMessage').value;
                const csrfToken = ''' + repr(csrf_token) + ''';
                
                fetch('/api/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        csrf_token: csrfToken,
                        username: username,
                        message: message
                    })
                })
                .then(response => response.json())
                .then(data => {
                    const responseDiv = document.getElementById('response');
                    if (data.error) {
                        responseDiv.innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                    } else {
                        responseDiv.innerHTML = '<div class="success">Success: ' + data.message + '</div>';
                    }
                })
                .catch(error => {
                    document.getElementById('response').innerHTML = '<div class="error">Error: ' + error + '</div>';
                });
            }
            
            document.getElementById('protectedForm').addEventListener('submit', function(e) {
                const responseDiv = document.getElementById('response');
                responseDiv.innerHTML = '<div class="success">Form submitted successfully!</div>';
            });
        </script>
    </body>
    </html>
    '''
    
    return render_template_string(html)

@app.route('/submit', methods=['POST'])
@csrf_protect
def submit_form():
    """Handle form submission with CSRF protection."""
    username = request.form.get('username')
    message = request.form.get('message')
    
    if not username or not message:
        return jsonify({'error': 'Missing required fields'}), 400
    
    return jsonify({
        'message': f'Form received from {username}: {message}',
        'method': 'form'
    })

@app.route('/api/submit', methods=['POST'])
@csrf_protect
def api_submit():
    """Handle AJAX submission with CSRF protection."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    username = data.get('username')
    message = data.get('message')
    
    if not username or not message:
        return jsonify({'error': 'Missing required fields'}), 400
    
    return jsonify({
        'message': f'API received from {username}: {message}',
        'method': 'api'
    })

@app.route('/api/data', methods=['PUT'])
@csrf_protect
def update_data():
    """Handle PUT request with CSRF protection."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    return jsonify({
        'message': 'Data updated successfully',
        'data': data
    })

@app.route('/api/delete/<int:item_id>', methods=['DELETE'])
@csrf_protect
def delete_data(item_id):
    """Handle DELETE request with CSRF protection."""
    return jsonify({
        'message': f'Item {item_id} deleted successfully'
    })

@app.route('/test-csrf-failure', methods=['POST'])
@csrf_protect
def test_csrf_failure():
    """Endpoint to test CSRF protection failure."""
    return jsonify({'message': 'This should not be reached without valid CSRF token'})

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)