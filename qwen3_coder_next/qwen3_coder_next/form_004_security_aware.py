import re
from flask import Flask, request, jsonify, render_template_string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape
import bleach

app = Flask(__name__)

# Configure rate limiting - 5 requests per hour per IP
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Rate limit for contact form specifically
@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")
def contact_form():
    # Honeypot field check - should be empty (hidden from humans)
    if request.form.get('website') or request.form.get('phone'):
        return jsonify({
            "error": "Bot detected. Submission blocked."
        }), 403
    
    # Get and validate form data
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    message = request.form.get('message', '').strip()
    
    # Server-side validation
    errors = []
    
    if not name:
        errors.append("Name is required.")
    elif len(name) < 2 or len(name) > 100:
        errors.append("Name must be between 2 and 100 characters.")
    
    if not email:
        errors.append("Email is required.")
    else:
        # Basic email validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            errors.append("Invalid email format.")
    
    if not message:
        errors.append("Message is required.")
    elif len(message) < 10 or len(message) > 5000:
        errors.append("Message must be between 10 and 5000 characters.")
    
    # If validation fails, return error
    if errors:
        return jsonify({
            "error": "Validation failed",
            "details": errors
        }), 400
    
    # Sanitize inputs using bleach for XSS prevention
    sanitized_name = bleach.clean(name, tags=[], strip=True)
    sanitized_email = bleach.clean(email, tags=[], strip=True)
    sanitized_message = bleach.clean(message, tags=['p', 'br', 'strong', 'em'], strip=True)
    
    # Additional sanitization - remove control characters and normalize whitespace
    def sanitize_text(text):
        # Remove null bytes and other control characters (except common whitespace)
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
        # Normalize whitespace
        return ' '.join(text.split())
    
    sanitized_name = sanitize_text(sanitized_name)
    sanitized_email = sanitize_text(sanitized_email)
    sanitized_message = sanitize_text(sanitized_message)
    
    # In a real application, you would send an email here
    # For this example, we'll just simulate successful processing
    try:
        # Here you'd typically use smtplib or a service like SendGrid
        # Example: send_email(sanitized_name, sanitized_email, sanitized_message)
        
        return jsonify({
            "success": True,
            "message": "Thank you for your message. We'll get back to you shortly."
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error processing contact form: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing your submission. Please try again later."
        }), 500

# Simple HTML template for the contact form (for demonstration)
@app.route('/contact')
def contact_form_page():
    html_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Contact Form</title>
        <style>
            .honeypot { display: none; }
            .form-group { margin-bottom: 1rem; }
            label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
            input, textarea { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
            button { background-color: #007bff; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; }
        </style>
    </head>
    <body>
        <h1>Contact Us</h1>
        <form method="POST" action="/contact">
            <div class="form-group">
                <label for="name">Name:</label>
                <input type="text" id="name" name="name" required maxlength="100">
            </div>
            
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required maxlength="255">
            </div>
            
            <div class="form-group">
                <label for="message">Message:</label>
                <textarea id="message" name="message" rows="5" required maxlength="5000"></textarea>
            </div>
            
            <!-- Honeypot fields (hidden from humans) -->
            <div class="honeypot">
                <label for="website">Website:</label>
                <input type="text" id="website" name="website">
                
                <label for="phone">Phone:</label>
                <input type="tel" id="phone" name="phone">
            </div>
            
            <button type="submit">Send Message</button>
        </form>
    </body>
    </html>
    '''
    return render_template_string(html_template)

if __name__ == '__main__':
    app.run(debug=True)