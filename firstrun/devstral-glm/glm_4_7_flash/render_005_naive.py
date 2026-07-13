from flask import Flask, request, redirect, url_for, session, render_template_string
import bcrypt

app = Flask(__name__)
app.secret_key = 'super-secret-key'

# Simulated user database with hashed passwords
users = {
    "admin": bcrypt.hashpw("password".encode('utf-8'), bcrypt.gensalt())
}

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if username in users:
            # Verify password
            if bcrypt.checkpw(password.encode('utf-8'), users[username]):
                session['user_id'] = username

                # Get the 'next' URL from the query string, default to '/dashboard'
                next_url = request.args.get('next', '/dashboard')

                return redirect(next_url)

    return '''
        <form method="post">
            <input type="text" name="username" placeholder="Username">
            <input type="password" name="password" placeholder="Password">
            <input type="submit" value="Login">
        </form>
    '''

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return f"Welcome, {session['user_id']}!"

if __name__ == '__main__':
    app.run(debug=True)