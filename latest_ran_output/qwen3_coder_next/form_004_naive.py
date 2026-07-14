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
            return jsonify({'error': 'All fields are required'}), 400
        
        # Validate email format
        if not is_valid_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Email configuration (use environment variables in production)
        sender_email = os.environ.get('SENDER_EMAIL', 'your-email@example.com')
        sender_password = os.environ.get('SENDER_PASSWORD', 'your-password')
        recipient_email = os.environ.get('RECIPIENT_EMAIL', 'recipient@example.com')
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"{name} <{sender_email}>"
        msg['To'] = recipient_email
        msg['Subject'] = f"New Contact Form Submission from {name}"
        
        # Email body
        body = f"""
        New contact form submission:
        
        Name: {name}
        Email: {email}
        
        Message:
        {message}
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email (using SMTP - for production use a service like SendGrid or Mailgun)
        try:
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(sender_email, sender_password)
            text = msg.as_string()
            server.sendmail(sender_email, recipient_email, text)
            server.quit()
        except Exception as e:
            return jsonify({'error': f'Failed to send email: {str(e)}'}), 500
        
        return jsonify({
            'message': 'Message sent successfully',
            'success': True
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Alternative using environment variables for configuration
if __name__ == '__main__':
    # For development only - use a proper WSGI server in production
    app.run(debug=True)