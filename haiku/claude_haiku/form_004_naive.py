import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from anthropic import Anthropic

app = Flask(__name__)
CORS(app)

# Initialize Anthropic client
client = Anthropic()

# Store conversation history for multi-turn interactions
conversation_history = []

# Email configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SENDER_EMAIL = os.getenv('SENDER_EMAIL', 'your-email@example.com')
SENDER_PASSWORD = os.getenv('SENDER_PASSWORD', 'your-app-password')
RECIPIENT_EMAIL = os.getenv('RECIPIENT_EMAIL', 'admin@example.com')


def send_email(name: str, email: str, subject: str, message: str) -> bool:
    """Send an email using SMTP."""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = RECIPIENT_EMAIL
        msg['Subject'] = f"Contact Form: {subject}"
        
        # Create email body
        body = f"""
New Contact Form Submission

Name: {name}
Email: {email}
Subject: {subject}

Message:
{message}
"""
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def validate_contact_form(data: dict) -> tuple[bool, str]:
    """Validate contact form data."""
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    subject = data.get('subject', '').strip()
    message = data.get('message', '').strip()
    
    if not name or len(name) < 2:
        return False, "Name must be at least 2 characters"
    
    if not email or '@' not in email:
        return False, "Valid email is required"
    
    if not subject or len(subject) < 3:
        return False, "Subject must be at least 3 characters"
    
    if not message or len(message) < 10:
        return False, "Message must be at least 10 characters"
    
    return True, ""


def get_ai_confirmation(name: str, email: str, subject: str, message: str) -> str:
    """Use Claude to generate a professional confirmation message."""
    global conversation_history
    
    # Add user message to conversation history
    user_message = f"""
A contact form was just submitted with the following details:
- Name: {name}
- Email: {email}
- Subject: {subject}
- Message: {message}

Please generate a brief, professional confirmation message that will be sent to the user acknowledging receipt of their contact form submission.
"""
    
    conversation_history.append({
        "role": "user",
        "content": user_message
    })
    
    # Call Claude API with conversation history
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=300,
        system="You are a professional email assistant. Generate brief, friendly confirmation messages for contact form submissions.",
        messages=conversation_history
    )
    
    # Extract and store the response
    assistant_message = response.content[0].text
    conversation_history.append({
        "role": "assistant",
        "content": assistant_message
    })
    
    # Keep conversation history manageable (last 10 messages)
    if len(conversation_history) > 10:
        conversation_history.pop(0)
    
    return assistant_message


@app.route('/api/contact', methods=['POST'])
def contact_form():
    """Process contact form submission."""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Validate form data
        is_valid, error_message = validate_contact_form(data)
        if not is_valid:
            return jsonify({'success': False, 'error': error_message}), 400
        
        # Extract validated data
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        
        # Send email
        email_sent = send_email(name, email, subject, message)
        
        if not email_sent:
            return jsonify({'success': False, 'error': 'Failed to send email'}), 500
        
        # Generate AI confirmation message
        confirmation = get_ai_confirmation(name, email, subject, message)
        
        return jsonify({
            'success': True,
            'message': 'Your contact form has been submitted successfully',
            'confirmation': confirmation
        }), 200
    
    except json.JSONDecodeError:
        return jsonify({'success': False, 'error': 'Invalid JSON'}), 400
    except Exception as e:
        print(f"Error processing contact form: {e}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500


@app.route('/api/contact/status', methods=['GET'])
def contact_status():
    """Check if the contact form service is available."""
    return jsonify({
        'status': 'operational',
        'email_configured': bool(SENDER_EMAIL and SENDER_PASSWORD),
        'ai_available': True
    }), 200


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)