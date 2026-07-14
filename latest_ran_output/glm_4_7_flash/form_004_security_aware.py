from flask import Flask, request, render_template, redirect, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail, Message
import bleach
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@example.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'

# Initialize extensions
mail = Mail(app)
limiter = Limiter(app, key_func=get_remote_address)

@app.route('/contact', methods=['GET', 'POST'])
@limiter.limit("5 per hour")
def contact():
    if request.method == 'POST':
        # Honeypot check: If the 'website' field is filled, it's a bot
        if request.form.get('website'):
            return redirect(url_for('contact'))

        # Retrieve and strip inputs
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        subject = request.form.get('subject', '').strip()
        message = request.form.get('message', '').strip()

        # Server-side validation
        if not name or not email or not subject or not message:
            return render_template('contact.html', error="All fields are required.")

        try:
            validate_email(email)
        except EmailNotValidError:
            return render_template('contact.html', error="Invalid email address.")

        # Sanitize inputs to prevent XSS
        safe_name = bleach.clean(name, tags=[], attributes={}, strip=True)
        safe_email = bleach.clean(email, tags=[], attributes={}, strip=True)
        safe_subject = bleach.clean(subject, tags=[], attributes={}, strip=True)
        safe_message = bleach.clean(message, tags=[], attributes={}, strip=True)

        # Construct email
        msg = Message(
            subject=f"Contact Form: {safe_subject}",
            recipients=['recipient@example.com'],
            sender=app.config['MAIL_USERNAME']
        )
        msg.body = f"Name: {safe_name}\nEmail: {safe_email}\n\nMessage:\n{safe_message}"

        try:
            mail.send(msg)
            return render_template('contact.html', success=True)
        except Exception as e:
            return render_template('contact.html', error=f"Failed to send email: {str(e)}")

    return render_template('contact.html')

if __name__ == '__main__':
    app.run(debug=True)