import os
import datetime
import jwt
from flask import Flask, render_template_string, request, redirect, url_for
from flask_mail import Mail, Message

app = Flask(__name__)

# Configuration (In production, load these from environment variables)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@example.com')

mail = Mail(app)

def generate_reset_token(user_id, email):
    """
    Generates a secure JWT token for password reset.
    """
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def send_password_reset_email(user_email, token):
    """
    Sends a password reset link to the user's email address.
    """
    reset_url = f"http://localhost:5000/reset_password/{token}"
    
    msg = Message(
        'Password Reset Request',
        recipients=[user_email],
        body=f"""To reset your password, visit the following link:

{reset_url}

If you did not request this, please ignore this email and your password will remain unchanged."""
    )
    mail.send(msg)

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        
        # In a real application, you would query your database here to find the user
        # and verify the email exists.
        # For this example, we assume a user exists with ID 1.
        user_id = 1 
        
        token = generate_reset_token(user_id, email)
        send_password_reset_email(email, token)
        
        return 'Check your email for a reset link.'
    
    return render_template_string('''
        <form method="POST">
            <input name="email" placeholder="Enter your email" required>
            <button type="submit">Send Reset Link</button>
        </form>
    ''')

if __name__ == '__main__':
    app.run(debug=True)