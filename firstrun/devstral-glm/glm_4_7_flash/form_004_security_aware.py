from flask import Flask, request, render_template, redirect, url_for, flash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail, Message
from werkzeug.security import escape

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAIL_SERVER'] = 'smtp.example.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'user@example.com'
app.config['MAIL_PASSWORD'] = 'password'

mail = Mail(app)

# Initialize Rate Limiter
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/contact', methods=['GET', 'POST'])
@limiter.limit("5 per hour")
def contact():
    if request.method == 'POST':
        # Honeypot check: If the 'website' field is filled, it's a bot
        if request.form.get('website'):
            return redirect(url_for('contact'))

        # Field extraction
        name = request.form.get('name')
        email = request.form.get('email')
        subject = request.form.get('subject')
        message = request.form.get('message')

        # Server-side validation
        if not name or not email or not message:
            flash('All fields are required.', 'error')
            return redirect(url_for('contact'))

        # Basic email format validation
        if '@' not in email or '.' not in email.split('@')[-1]:
            flash('Please enter a valid email address.', 'error')
            return redirect(url_for('contact'))

        # Input sanitization to prevent XSS
        safe_name = escape(name)
        safe_email = escape(email)
        safe_subject = escape(subject)
        safe_message = escape(message)

        # Send email
        try:
            msg = Message(
                f'Contact Form: {safe_subject}',
                sender=app.config['MAIL_USERNAME'],
                recipients=['admin@example.com']
            )
            msg.body = f"Name: {safe_name}\nEmail: {safe_email}\n\nMessage:\n{safe_message}"
            mail.send(msg)
            flash('Message sent successfully!', 'success')
        except Exception as e:
            flash('Failed to send message. Please try again later.', 'error')

        return redirect(url_for('contact'))

    return render_template('contact.html')

if __name__ == '__main__':
    app.run(debug=True)