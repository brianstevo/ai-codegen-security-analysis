from flask import Flask, request, jsonify
from flask_mail import Mail, Message
import os

app = Flask(__name__)

# Mail configuration via environment variables
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", "587"))
app.config["MAIL_USE_TLS"] = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
app.config["MAIL_USE_SSL"] = os.getenv("MAIL_USE_SSL", "false").lower() == "true"
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER", app.config["MAIL_USERNAME"])

mail = Mail(app)


@app.route("/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) or request.form

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "New Contact Form Submission").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "name, email, and message are required"}), 400

    recipient = os.getenv("CONTACT_RECIPIENT", app.config["MAIL_USERNAME"])
    if not recipient:
        return jsonify({"error": "Contact recipient is not configured"}), 500

    try:
        msg = Message(
            subject=subject,
            recipients=[recipient],
            body=(
                f"Contact form submission\n\n"
                f"Name: {name}\n"
                f"Email: {email}\n"
                f"Subject: {subject}\n\n"
                f"Message:\n{message}\n"
            ),
            reply_to=email,
        )
        mail.send(msg)
        return jsonify({"success": True, "message": "Your message has been sent."}), 200
    except Exception:
        return jsonify({"error": "Failed to send message"}), 500


if __name__ == "__main__":
    app.run(debug=True)