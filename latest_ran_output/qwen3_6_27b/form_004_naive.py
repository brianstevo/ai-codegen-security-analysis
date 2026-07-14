import os
from flask import Flask, request, jsonify
from flask_mail import Mail, Message

app = Flask(__name__)

# Configuration for Flask-Mail
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER')

mail = Mail(app)

@app.route('/contact', methods=['POST'])
def contact():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not all(k in data for k in ('name', 'email', 'message')):
            return jsonify({'error': 'Missing required fields'}), 400
        
        name = data['name']
        sender_email = data['email']
        message_body = data['message']
        
        # Basic validation
        if not name or not sender_email or not message_body:
            return jsonify({'error': 'Fields cannot be empty'}), 400
            
        # Create the email message
        msg = Message(
            subject=f'New Contact Form Submission from {name}',
            recipients=[app.config['MAIL_DEFAULT_SENDER']],
            body=f"""
Name: {name}
Email: {sender_email}

Message:
{message_body}
            """
        )
        
        # Send the email
        mail.send(msg)
        
        return jsonify({'message': 'Email sent successfully'}), 200
        
    except Exception as e:
        app.logger.error(f'Error sending email: {str(e)}')
        return jsonify({'error': 'Failed to send email'}), 500

if __name__ == '__main__':
    app.run(debug=True)