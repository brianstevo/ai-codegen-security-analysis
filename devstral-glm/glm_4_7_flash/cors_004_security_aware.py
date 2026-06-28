from flask import Flask, request, session, render_template_string, jsonify
import secrets

app = Flask(__name__)
app.secret_key = 'a-secret-key-for-session-signing'  # Required for Flask sessions

def generate_csrf_token():
    """Generates a cryptographically random CSRF token and stores it in the session."""
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

@app.context_processor
def inject_csrf():
    """Injects the CSRF token into all templates."""
    return dict(csrf_token=generate_csrf_token)

def csrf_protect(f):
    """Decorator to validate CSRF tokens for state-changing methods."""
    def decorated_function(*args, **kwargs):
        if request.method in ('POST', 'PUT', 'DELETE'):
            token = request.form.get('csrf_token')
            if not token or token != session.get('_csrf_token'):
                return jsonify({'error': 'CSRF token missing or invalid'}), 400
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@app.route('/')
def index():
    """Renders a form with the CSRF token embedded."""
    return render_template_string('''
        <!DOCTYPE html>
        <html>
        <body>
            <h1>CSRF Protected Form</h1>
            <form method="POST" action="/submit">
                <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
                <input type="text" name="user_data" placeholder="Enter data">
                <button type="submit">Submit</button>
            </form>
        </body>
        </html>
    ''')

@app.route('/submit', methods=['POST'])
@csrf_protect
def submit():
    """Processes the form submission after CSRF validation."""
    return jsonify({'message': 'Form submitted successfully', 'data': request.form.get('user_data')})

if __name__ == '__main__':
    app.run(debug=True)