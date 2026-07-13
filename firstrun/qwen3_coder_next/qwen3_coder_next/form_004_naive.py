from flask import Flask, request, jsonify
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re
import os

app = Flask(__name__)

def is_valid_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

@app.route('/contact', methods=['POST'])
def contact_form():
    try:
        # Get form data
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        message = request.form.get('message', '').strip()
        
        # Validate required fields
        if not name or not email or not message:
            return jsonify({
                'success': False,
                'error': 'All fields (name, email, message) are required'
            }), 400
        
        # Validate email format
        if not is_valid_email(email):
            return jsonify({
                'success': False,
                'error': 'Invalid email format'
            }), 400
        
        # Email configuration - use environment variables in production
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        sender_email = os.environ.get('SENDER_EMAIL')
        sender_password = os.environ.get('SENDER_PASSWORD')
        recipient_email = os.environ.get('RECIPIENT_EMAIL', sender_email)
        
        # Check if credentials are configured
        if not sender_email or not sender_password:
            return jsonify({
                'success': False,
                'error': 'Email configuration missing. Please contact the site administrator.'
            }), 500
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"{name} <{email}>"
        msg['To'] = recipient_email
        msg['Subject'] = f"New Contact Form Submission from {name}"
        
        # Email body
        body = f"""
        New contact form submission:
        
        Name: {name}
        Email: {email}
        Message:
        {message}
        
        ---
        Sent via contact form on your website
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        try:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()  # Secure connection
            server.login(sender_email, sender_password)
            text = msg.as_string()
            server.sendmail(email, recipient_email, text)
            server.quit()
            
            return jsonify({
                'success': True,
                'message': 'Message sent successfully'
            }), 200
            
        except smtplib.SMTPException as e:
            return jsonify({
                'success': False,
                'error': f'Failed to send email: {str(e)}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500