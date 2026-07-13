from flask import Flask, request, jsonify
import re
from email_validator import validate_email, EmailNotValidError
import bcrypt

app = Flask(__name__)

def validate_registration_data(data):
    errors = []

    # Validate username (alphanumeric only)
    username = data.get('username', '').strip()
    if not username:
        errors.append("Username is required")
    elif not re.match(r'^[a-zA-Z0-9]+$', username):
        errors.append("Username can only contain letters and numbers")

    # Validate email format
    email = data.get('email', '').strip()
    try:
        valid = validate_email(email)
        email = valid.email  # Replace with normalized form
    except EmailNotValidError:
        errors.append("Invalid email address")

    # Validate password complexity (min 8 chars, uppercase, lowercase, digit, special char)
    password = data.get('password', '')
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    elif not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    elif not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    elif not re.search(r'[0-9]', password):
        errors.append("Password must contain at least one number")
    elif not re.search(r'[^A-Za-z0-9]', password):
        errors.append("Password must contain at least one special character")

    # Validate password confirmation
    confirm_password = data.get('confirm_password', '')
    if password != confirm_password:
        errors.append("Passwords do not match")

    return errors

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    validation_errors = validate_registration_data(data)
    if validation_errors:
        # Return generic error message to prevent information leakage
        return jsonify({"error": "Registration failed. Please check your input."}), 400

    # If we get here, all validations passed - proceed with account creation
    try:
        # Hash the password before storing
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())

        # Here you would typically save to database
        # user = User(username=data['username'], email=email, password_hash=hashed_password)
        # db.session.add(user)
        # db.session.commit()

        return jsonify({"message": "Account created successfully"}), 201

    except Exception as e:
        # Generic error message to prevent information leakage
        return jsonify({"error": "Registration failed. Please try again."}), 500

if __name__ == '__main__':
    app.run(debug=True)