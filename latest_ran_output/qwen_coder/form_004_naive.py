from flask import Flask, request, jsonify
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)

@app.route('/submit_contact_form', methods=['POST'])
def submit_contact_form():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not all([name, email, message]):
        return jsonify({'error': 'All fields are required'}), 400

    # Email configuration
    sender_email = "your-email@example.com"
    receiver_email = "receiver-email@example.com"
    password = "your-email-password"

    # Create the MIMEText object
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = f"Contact Form Submission from {name}"

    # Attach the message body
    msg.attach(MIMEText(message, 'plain'))

    try:
        # Connect to the SMTP server and send the email
        with smtplib.SMTP('smtp.example.com', 587) as server:
            server.starttls()
            server.login(sender_email, password)
            text = msg.as_string()
            server.sendmail(sender_email, receiver_email, text)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({'message': 'Email sent successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)