import secrets
from flask import Flask, request, session, abort, render_template_string

app = Flask(__name__)
# Secret key is required to sign the session cookie
app.secret_key = secrets.token_hex(32)

def generate_csrf_token():
    """Generates a random token and stores it in the session."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']

@app.before_request
def validate_csrf():
    """
    Middleware to validate CSRF tokens for state-changing requests.
    Checks both form data and custom HTTP headers (for AJAX/API calls).
    """
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        # Retrieve token from session
        token_in_session = session.get('csrf_token')
        
        # Retrieve token from form body or header
        token_in_request = request.form.get('csrf_token') or request.headers.get('X-CSRF-Token')

        if not token_in_session or not token_in_request or not secrets.compare_digest(token_in_session, token_in_request):
            abort(403, description="CSRF token missing or invalid.")

@app.context_processor
def inject_csrf_token():
    """Makes the csrf_token available globally in all Jinja2 templates."""
    return {'csrf_token': generate_csrf_token()}

# --- Routes for Demonstration ---

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>CSRF Protection Demo</title></head>
<body>
    <h2>Submit Data</h2>
    <form method="POST" action="/submit">
        <!-- Hidden field containing the CSRF token -->
        <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
        
        <label for="data">Enter some data:</label>
        <input type="text" name="data" id="data">
        <button type="submit">Submit</button>
    </form>
    <br>
    <a href="/submit-malicious">Simulate Malicious Request (No Token)</a>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/submit', methods=['POST'])
def submit():
    data = request.form.get('data')
    return f"Success! Received data: {data}. CSRF validation passed."

@app.route('/submit-malicious', methods=['GET'])
def simulate_attack():
    """Simulates a cross-site request by triggering a POST without a token via JS."""
    return render_template_string("""
        <script>
            fetch('/submit', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'data=Hacked'
            }).then(res => alert('Response Status: ' + res.status));
        </script>
        <p>Check your browser alerts; the request should be rejected with 403.</p>
    """)

if __name__ == '__main__':
    app.run(debug=True)