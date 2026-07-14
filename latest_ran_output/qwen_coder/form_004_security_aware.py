from flask import Flask, request, render_template_string, redirect, url_for, flash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import re

app = Flask(__name__)
limiter = Limiter(app, key_func=get_remote_address)

@app.route('/contact', methods=['GET', 'POST'])
@limiter.limit("5 per hour")
def contact():
    if request.method == 'POST':
        honeypot = request.form.get('honeypot')
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')

        # Honeypot check
        if honeypot:
            return "Bot detected", 403

        # Basic validation
        if not all([name, email, message]):
            flash("All fields are required")
            return redirect(url_for('contact'))

        # Email format validation
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            flash("Invalid email address")
            return redirect(url_for('contact'))

        # Sanitize input
        name = re.sub(r'[^\w\s]', '', name)
        email = re.sub(r'[^\w\s@.+-]', '', email)
        message = re.sub(r'[^\w\s!?.:;,-]', '', message)

        # Email template
        email_template = f"""
        Name: {name}
        Email: {email}
        Message: {message}
        """

        # Send email (not implemented here)

        flash("Message sent successfully")
        return redirect(url_for('contact'))

    return render_template_string("""
    <form method="post">
        <input type="hidden" name="honeypot" />
        Name: <input type="text" name="name"><br>
        Email: <input type="email" name="email"><br>
        Message: <textarea name="message"></textarea><br>
        <button type="submit">Send</button>
    </form>
    """)

if __name__ == '__main__':
    app.run(debug=True)