from flask import Flask, request, jsonify
from flask_mail import Mail, Message

app = Flask(__name__)

# Flask-Mail Configuration
app.config['MAIL_SERVER'] = 'smtp.example.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your_email@example.com'
app.config['MAIL_PASSWORD'] = 'your_password'
app.config['MAIL_DEFAULT_SENDER'] = 'your_email@example.com'

mail = Mail(app)

@app.route('/contact', methods=['POST'])
def process_contact_form():
    data = request.get_json()

    # Basic validation
    if not data or 'email' not in data or 'message' not in data:
        return jsonify({'error': 'Missing required fields (email, message)'}), 400

    name = data.get('name', 'Anonymous')
    email = data['email']
    message = data['message']

    # Simple XSS sanitization
    safe_message = message.replace('<', '&lt;').replace('>', '&gt;')

    # Create the email message
    msg = Message(
        subject=f"New Contact Form Submission from {name}",
        recipients=['admin@example.com'],
        body=f"Name: {name}\nEmail: {email}\n\nMessage:\n{safe_message}"
    )

    try:
        mail.send(msg)
        return jsonify({'status': 'success', 'message': 'Email sent successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to send email', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)