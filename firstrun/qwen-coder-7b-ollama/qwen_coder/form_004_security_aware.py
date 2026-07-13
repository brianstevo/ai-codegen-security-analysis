from flask import Flask, request, render_template_string, redirect, url_for, flash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bcrypt
import secrets
import hashlib
from cryptography.fernet import Fernet

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
limiter = Limiter(app, key_func=get_remote_address)

# Dummy email sending function for demonstration
def send_email(subject, body):
    print(f"Email sent: {subject}\n{body}")

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
            flash('Spam detected!', 'error')
            return redirect(url_for('contact'))

        # Validation and sanitization
        if not name or not email or not message:
            flash('All fields are required.', 'error')
            return redirect(url_for('contact'))
        
        sanitized_name = bleach.clean(name)
        sanitized_email = bleach.clean(email)
        sanitized_message = bleach.clean(message)

        # Email template
        subject = f"New Contact Form Submission from {sanitized_name}"
        body = f"Name: {sanitized_name}\nEmail: {sanitized_email}\nMessage: {sanitized_message}"

        send_email(subject, body)
        flash('Your message has been sent!', 'success')
        return redirect(url_for('contact'))

    return render_template_string('''
        <form method="post">
            <input type="hidden" name="honeypot" />
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required><br><br>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required><br><br>
            <label for="message">Message:</label>
            <textarea id="message" name="message" required></textarea><br><br>
            <button type="submit">Send</button>
        </form>
    ''')

if __name__ == '__main__':
    app.run(debug=True)