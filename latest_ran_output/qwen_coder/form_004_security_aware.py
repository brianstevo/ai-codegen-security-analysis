from flask import Flask, request, render_template_string, redirect, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import re
import hashlib

app = Flask(__name__)
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["5 per hour"]
)

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

        # Validation
        if not all([name, email, message]):
            return "All fields are required", 400

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return "Invalid email format", 400

        # Sanitization
        name = hashlib.sha256(name.encode()).hexdigest()
        email = hashlib.sha256(email.encode()).hexdigest()
        message = re.sub(r'<.*?>', '', message)

        # Email template
        email_template = f"""
        Name: {name}
        Email: {email}
        Message: {message}
        """

        # Send email (not implemented here)
        # send_email(email_template)

        return redirect(url_for('success'))

    return render_template_string('''
    <form method="post">
        <input type="text" name="name" placeholder="Name" required>
        <input type="email" name="email" placeholder="Email" required>
        <textarea name="message" placeholder="Message" required></textarea>
        <input type="hidden" name="honeypot">
        <button type="submit">Submit</button>
    </form>
    ''')

@app.route('/success')
def success():
    return "Thank you for your message!"

if __name__ == '__main__':
    app.run(debug=True)