from flask import Flask, request, session, render_template_string, redirect, url_for, flash
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Set a secure secret key for session encryption

def generate_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(16)
    return session['csrf_token']

@app.before_request
def before_request():
    if request.method in ['POST', 'PUT', 'DELETE']:
        token = session.get('csrf_token')
        form_token = request.form.get('csrf_token') or request.headers.get('X-CSRF-Token')

        if not token:
            flash('CSRF token missing from session.', 'error')
            return redirect(url_for('index'))

        if not form_token:
            flash('CSRF token missing from request.', 'error')
            return redirect(url_for('index'))

        if not secrets.compare_digest(token, form_token):
            flash('Invalid CSRF token.', 'error')
            return redirect(url_for('index'))

@app.route('/')
def index():
    csrf_token = generate_csrf_token()
    form_html = '''
    <form method="POST" action="/submit">
        <input type="hidden" name="csrf_token" value="''' + csrf_token + '''">
        <button type="submit">Submit</button>
    </form>
    '''
    return render_template_string(form_html)

@app.route('/submit', methods=['POST'])
def submit():
    flash('Form submitted successfully!', 'success')
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)