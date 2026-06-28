import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration - In production, use environment variables
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', 'your-email@gmail.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', 'your-app-password')
CONTACT_RECEIVER_EMAIL = os.environ.get('CONTACT_RECEIVER_EMAIL', 'admin@example.com')

def send_contact_email(sender_name, sender_email, subject, message):
    """Helper function to handle the SMTP logic."""
    try:
        # Create a multipart message
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER  # Must be the authenticated user for many providers
        msg['To'] = CONTACT_RECEIVER_EMAIL
        msg['Subject'] = f"Contact Form: {subject}"

        # Compose email body
        body = f"You have received a new contact form submission:\n\n" \
               f"Name: {sender_name}\n" \
               f"Email: {sender_email}\n" \
               f"Message:\n{message}"
        
        msg.attach(MIMEText(body, 'plain'))

        # Connect to server and send
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()  # Secure the connection
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        app.logger.error(f"Email failed to send: {str(e)}")
        return False

@app.route('/api/contact', methods=['POST'])
def handle_contact():
    """
    Route to process contact form submissions.
    Expected JSON payload: { "name": "...", "email": "...", "subject": "...", "message": "..." }
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    # Validation
    required_fields = ['name', 'email', 'subject', 'message']
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

    name = data['name']
    email = data['email']
    subject = data['subject']
    message = data['message']

    # Send the email
    success = send_contact_email(name, email, subject, message)

    if success:
        return jsonify({"status": "success", "message": "Your message has been sent successfully!"}), 200
    else:
        return jsonify({"status": "error", "message": "Failed to send message. Please try again later."}), 500

if __name__ == '__main__':
    # Note: Ensure SMTP_USER and SMTP_PASSWORD are set in your environment variables
    app.run(debug=True)