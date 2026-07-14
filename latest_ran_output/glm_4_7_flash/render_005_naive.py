from flask import Flask, request, redirect, url_for, flash, render_template_string
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

app = Flask(__name__)
# Use secrets module for secure key generation
app.secret_key = secrets.token_hex(32)

login_manager = LoginManager()
login_manager.init_app(app)

# Mock User class
class User(UserMixin):
    def __init__(self, id, username, password_hash):
        self.id = id
        self.username = username
        self.password_hash = password_hash

# In-memory user store
users = {}

@login_manager.user_loader
def load_user(user_id):
    return users.get(int(user_id))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        # Get the 'next' parameter from query string or form data
        next_url = request.args.get('next') or request.form.get('next')

        user = users.get(username)
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            # Redirect to the URL provided in the query string, or default to home
            return redirect(next_url or url_for('index'))
        else:
            flash('Invalid username or password')

    return render_template_string('''
        <form method="post">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <input type="hidden" name="next" value="{{ request.args.get('next') }}">
            <button type="submit">Login</button>
        </form>
    ''')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return f"Hello, {current_user.username}! You are logged in."

if __name__ == '__main__':
    # Initialize a dummy user for demonstration
    users['admin'] = User(1, 'admin', generate_password_hash('secret'))
    app.run(debug=True)