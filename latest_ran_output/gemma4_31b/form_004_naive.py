import os
from flask import Flask, request, jsonify
from flask_mail import Mail, Message

app = Flask(__name__)

# Configuration for Email
# In production, use environment variables: os.environ.get('MAIL_USERNAME')
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER', 'your-email@gmail.com')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASS', 'your-app-password')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('EMAIL_USER', 'your-email@gmail.com')

mail = Mail(app)

@app.route('/api/contact', methods=['POST'])
def contact_form():
    """
    Processes a contact form submission and sends an email notification.
    Expected JSON payload: { "name": "...", "email": "...", "subject": "...", "message": "..." }
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    # Validation
    required_fields = ['name', 'email', 'message']
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

    name = data.get('name')
    email = data.get('email')
    subject = data.get('subject', 'New Contact Form Submission')
    message_body = data.get('message')

    try:
        # Construct the email content
        full_msg_text = f"You have received a new contact form submission:\n\n" \
                       f"Name: {name}\n" \
                       f"Email: {email}\n" \
                       f"Message: {message_body}"

        msg = Message(
            subject=f"{subject} - From {name}",
            sender=app.config['MAIL_DEFAULT_SENDER'],
            recipients=[app.config['MAIL_DEFAULT_SENDER']], # Sending to yourself
            body=full_msg_text
        )

        # Send the email
        mail.send(msg)

        return jsonify({"status": "success", "message": "Your message has been sent successfully!"}), 200

    except Exception as e:
        # Log the error in a real application
        return jsonify({"status": "error", "message": f"Failed to send email: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)