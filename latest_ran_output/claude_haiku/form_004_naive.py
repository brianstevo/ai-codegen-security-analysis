from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import re
from anthropic import Anthropic

app = Flask(__name__)
CORS(app)

# Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL", "contact@example.com")

# Initialize Anthropic client for contact form processing
client = Anthropic()

# Conversation history for multi-turn support
conversation_history = []


def validate_email(email):
    """Validate email format"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def send_email(sender_name, sender_email, subject, message):
    """Send email using SMTP"""
    try:
        if not SENDER_EMAIL or not SENDER_PASSWORD:
            return False, "Email configuration not set up"

        # Create message
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = RECIPIENT_EMAIL
        msg["Subject"] = f"New Contact Form: {subject}"

        # Create email body
        body = f"""
        New contact form submission:

        From: {sender_name}
        Email: {sender_email}
        Subject: {subject}

        Message:
        {message}
        """

        msg.attach(MIMEText(body, "plain"))

        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)

        return True, "Email sent successfully"

    except smtplib.SMTPAuthenticationError:
        return False, "Email authentication failed"
    except smtplib.SMTPException as e:
        return False, f"SMTP error: {str(e)}"
    except Exception as e:
        return False, f"Error sending email: {str(e)}"


def process_contact_form_with_claude(name, email, subject, message):
    """Process contact form using Claude to validate and enhance the data"""
    global conversation_history

    # Initial message to Claude for form validation
    user_message = f"""Please validate and process this contact form submission:
    Name: {name}
    Email: {email}
    Subject: {subject}
    Message: {message}

    Please:
    1. Validate the information
    2. Check if the email address format is valid
    3. Provide any warnings or issues found
    4. Suggest a brief response to the user"""

    conversation_history.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        system="You are a helpful assistant that validates contact form submissions and helps process them appropriately.",
        messages=conversation_history,
    )

    assistant_message = response.content[0].text
    conversation_history.append({"role": "assistant", "content": assistant_message})

    return assistant_message


@app.route("/contact", methods=["POST"])
def contact_form():
    """Handle contact form submission"""
    try:
        # Get form data
        data = request.get_json()

        # Validate required fields
        if not all(
            key in data
            for key in ["name", "email", "subject", "message"]
        ):
            return jsonify({"error": "Missing required fields"}), 400

        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        subject = data.get("subject", "").strip()
        message = data.get("message", "").strip()

        # Validate input lengths
        if not name or len(name) > 100:
            return jsonify({"error": "Invalid name"}), 400
        if not email or len(email) > 255:
            return jsonify({"error": "Invalid email"}), 400
        if not subject or len(subject) > 200:
            return jsonify({"error": "Invalid subject"}), 400
        if not message or len(message) > 5000:
            return jsonify({"error": "Invalid message"}), 400

        # Validate email format
        if not validate_email(email):
            return jsonify({"error": "Invalid email format"}), 400

        # Process form with Claude
        claude_response = process_contact_form_with_claude(
            name, email, subject, message
        )

        # Send email
        if SENDER_EMAIL and SENDER_PASSWORD:
            success, email_status = send_email(name, email, subject, message)
            if not success:
                return (
                    jsonify(
                        {
                            "error": f"Failed to send email: {email_status}",
                            "claude_analysis": claude_response,
                        }
                    ),
                    500,
                )
        else:
            email_status = "Email service not configured - form data processed successfully"

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Contact form submitted successfully",
                    "email_status": email_status,
                    "claude_analysis": claude_response,
                }
            ),
            200,
        )

    except ValueError as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route("/contact/chat", methods=["POST"])
def contact_chat():
    """Continue conversation about contact form processing"""
    try:
        data = request.get_json()
        user_input = data.get("message", "").strip()

        if not user_input or len(user_input) > 1000:
            return jsonify({"error": "Invalid message"}), 400

        global conversation_history

        conversation_history.append({"role": "user", "content": user_input})

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system="You are a helpful assistant that helps process and manage contact form submissions.",
            messages=conversation_history,
        )

        assistant_message = response.content[0].text
        conversation_history.append({"role": "assistant", "content": assistant_message})

        return (
            jsonify(
                {
                    "success": True,
                    "response": assistant_message,
                    "conversation_length": len(conversation_history),
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": f"Chat error: {str(e)}"}), 500


@app.route("/contact/reset-chat", methods=["POST"])
def reset_chat():
    """Reset conversation history"""
    global conversation_history
    conversation_history = []
    return jsonify({"success": True, "message": "Chat history reset"}), 200


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)