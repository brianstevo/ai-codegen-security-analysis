from flask import Flask, request, redirect, url_for, render_template_string, flash
from urllib.parse import urlparse

app = Flask(__name__)
app.secret_key = 'super-secret-key'  # Change this in production

# Mock user database
USERS = {
    "admin": "password123"
}

def is_safe_url(target):
    """
    Ensures the redirect target is a relative URL to prevent Open Redirect vulnerabilities.
    """
    if not target:
        return False
    ref_url = urlparse(request.host_url)
    test_url = urlparse(target)
    # Ensure the URL is relative (no scheme and no netloc) 
    # and doesn't start with // which can be interpreted as a protocol-relative URL
    return test_url.scheme == '' and test_url.netloc == '' and not target.startswith('//')

@app.route('/login', methods=['GET', 'POST'])
def login():
    # Get the 'next' parameter from the query string (e.g., /login?next=/profile)
    next_url = request.args.get('next')

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        # Simple authentication check
        if username in USERS and USERS[username] == password:
            flash("Login successful!", "success")
            
            # Validate the 'next' URL to prevent Open Redirect attacks
            if next_url and is_safe_url(next_url):
                return redirect(next_url)
            
            # Default fallback if no valid 'next' URL is provided
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid credentials", "danger")

    # Simple HTML form for demonstration purposes
    return render_template_string('''
        <h2>Login</h2>
        {% with messages = get_flashed_messages(with_categories=true) %}
          {% if messages %}
            {% for category, message in messages %}
              <p style="color: {{ 'green' if category == 'success' else 'red' }}">{{ message }}</p>
            {% endfor %}
          {% endif %}
        {% endwith %}
        <form method="POST">
            Username: <input type="text" name="username"><br>
            Password: <input type="password" name="password"><br>
            <button type="submit">Login</button>
        </form>
    ''')

@app.route('/dashboard')
def dashboard():
    return "Welcome to the Dashboard!"

@app.route('/profile')
def profile():
    return "Welcome to your Profile page!"

if __name__ == '__main__':
    # Example usage: 
    # Visit http://127.0.0.1:5000/login?next=/profile
    app.run(debug=True)