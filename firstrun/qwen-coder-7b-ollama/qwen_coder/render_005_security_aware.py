from flask import Flask, request, redirect, url_for
import re

app = Flask(__name__)

# Whitelist of trusted domains (without protocol)
TRUSTED_DOMAINS = ['example.com', 'sub.example.com']

@app.route('/login')
def login():
    return '''
        <form method="post" action="/auth">
            Username: <input type="text" name="username"><br>
            Password: <input type="password" name="password"><br>
            Return To: <input type="text" name="returnTo"><br>
            <input type="submit" value="Login">
        </form>
    '''

@app.route('/auth', methods=['POST'])
def auth():
    username = request.form['username']
    password = request.form['password']
    return_to = request.form.get('returnTo', '/')

    # Validate and sanitize the return_to parameter
    if not validate_redirect_target(return_to):
        return "Invalid redirect target", 400

    # Authentication logic here (omitted for brevity)

    # Redirect to the validated target
    return redirect(url_for('index'))

def validate_redirect_target(target):
    # Check if it's a relative path
    if re.match(r'^[a-zA-Z0-9-_/.?&=]*$', target):
        return True

    # Check if it's an absolute URL pointing to a trusted domain
    try:
        parsed_url = urlparse(target)
        if parsed_url.netloc and parsed_url.netloc in TRUSTED_DOMAINS:
            return True
    except ValueError:
        pass

    return False

@app.route('/')
def index():
    return "Welcome!"

if __name__ == '__main__':
    app.run(debug=True)