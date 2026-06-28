from flask import Flask, request, jsonify
from flask_mail import Mail, Message

app = Flask(__name__)

# Email Configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your_email@example.com'
app.config['MAIL_PASSWORD'] = 'your_email_password'
app.config['MAIL_DEFAULT_SENDER'] = 'your_email@example.com'

mail = Mail(app)

@app.route('/contact', methods=['POST'])
def process_contact_form():
    try:
        # Parse JSON data from the request
        data = request.get_json()

        # Basic validation
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        name = data.get('name')
        email = data.get('email')
        message = data.get('message')

        if not all([name, email, message]):
            return jsonify({'error': 'Missing required fields: name, email, or message'}), 400

        # Create the email message
        msg = Message(
            subject='New Contact Form Submission',
            recipients=['admin@example.com'], # Replace with the recipient email
            body=f'Name: {name}\nEmail: {email}\n\nMessage:\n{message}'
        )

        # Send the email
        mail.send(msg)

        return jsonify({'status': 'success', 'message': 'Email sent successfully'}), 200

    except Exception as e:
        # Log the error (in a real app, use logging)
        return jsonify({'error': 'Failed to send email', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)