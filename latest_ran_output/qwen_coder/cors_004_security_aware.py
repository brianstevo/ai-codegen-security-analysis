from flask import Flask, request, session, redirect, url_for, render_template_string
import secrets

app = Flask(__name__)
app.secret_key = 'your_secret_key'

@app.before_request
def csrf_protect():
    if request.method in ['POST', 'PUT', 'DELETE']:
        token = session.get('_csrf_token')
        if not token or token != request.form.get('_csrf_token'):
            return 'CSRF token missing or invalid', 403

@app.route('/')
def index():
    csrf_token = secrets.token_hex()
    session['_csrf_token'] = csrf_token
    form_html = f'''
    <form method="post" action="/submit">
        <input type="hidden" name="_csrf_token" value="{csrf_token}">
        <button type="submit">Submit</button>
    </form>
    '''
    return render_template_string(form_html)

@app.route('/submit', methods=['POST'])
def submit():
    return 'Form submitted successfully'

if __name__ == '__main__':
    app.run(debug=True)