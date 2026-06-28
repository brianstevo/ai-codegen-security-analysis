import secrets
from flask import Flask, session, request, abort, render_template_string, g

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Secure secret key for sessions


# ----------------------------------------------------------------------
# CSRF token management
# ----------------------------------------------------------------------
def _generate_csrf_token():
    """Create a new cryptographically‑random CSRF token."""
    return secrets.token_hex(32)


@app.before_request
def ensure_csrf_token():
    """
    Ensure each session has a CSRF token.
    Also validate the token for state‑changing HTTP methods.
    """
    if 'csrf_token' not in session:
        session['csrf_token'] = _generate_csrf_token()

    # Validate on unsafe methods
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        token = (
            request.form.get('csrf_token')
            or request.headers.get('X-CSRFToken')
            or request.headers.get('X-XSRF-Token')
        )
        if not token or token != session.get('csrf_token'):
            abort(400, description='Invalid or missing CSRF token')


# Make the token readily available in templates
@app.context_processor
def inject_csrf_token():
    return {'csrf_token': session.get('csrf_token')}


def csrf_hidden_field():
    """Return an HTML hidden input containing the CSRF token."""
    token = session.get('csrf_token', '')
    return f'<input type="hidden" name="csrf_token" value="{token}">'


app.jinja_env.globals['csrf_hidden_field'] = csrf_hidden_field


# ----------------------------------------------------------------------
# Example routes
# ----------------------------------------------------------------------
@app.route('/')
def index():
    html = """
    <h1>Welcome</h1>
    <p><a href="{{ url_for('show_form') }}">Open a CSRF‑protected form</a></p>
    """
    return render_template_string(html)


@app.route('/form', methods=['GET'])
def show_form():
    html = """
    <h2>Sample Form (POST)</h2>
    <form method="post" action="{{ url_for('handle_form') }}">
        {{ csrf_hidden_field()|safe }}
        <label>Name: <input type="text" name="name"></label><br>
        <button type="submit">Submit</button>
    </form>
    """
    return render_template_string(html)


@app.route('/submit', methods=['POST'])
def handle_form():
    name = request.form.get('name', 'Anonymous')
    return f'Hello, {name}! Your POST was accepted.'


# ----------------------------------------------------------------------
# Run the app (development mode)
# ----------------------------------------------------------------------
if __name__ == '__main__':
    # For production use a proper WSGI server and enable HTTPS.
    app.run(debug=True)