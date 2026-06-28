from flask import Flask, request, redirect, url_for, session, abort
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = 'replace-with-a-secure-random-secret-key'  # needed for sessions


def is_safe_redirect(target: str) -> bool:
    """
    Determines if the target URL is safe to redirect to.
    Only relative URLs (no scheme or netloc) are considered safe.
    """
    if not target:
        return False
    parsed = urlparse(target)
    return parsed.scheme == '' and parsed.netloc == ''


def authenticate(username: str, password: str) -> bool:
    """
    Placeholder authentication function.
    Replace with real credential checking (e.g., DB lookup + bcrypt).
    """
    # For demonstration purposes only:
    return username == "admin" and password == "password"


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            abort(400, description="Missing credentials")

        if authenticate(username, password):
            session['user'] = username  # simple session flag

            # Retrieve the desired redirect URL from query string (e.g., ?next=/dashboard)
            next_url = request.args.get('next')
            if is_safe_redirect(next_url):
                return redirect(next_url)
            else:
                return redirect(url_for('index'))
        else:
            abort(401, description="Invalid credentials")

    # GET request: render a simple login form (inline HTML for brevity)
    return '''
        <form method="post">
            <input name="username" placeholder="Username" required>
            <input name="password" type="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
    '''


@app.route('/')
def index():
    user = session.get('user')
    if user:
        return f'Hello, {user}! You are logged in.'
    return 'Welcome! Please <a href="/login">log in</a>.'


if __name__ == '__main__':
    app.run(debug=True)