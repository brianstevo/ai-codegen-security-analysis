from flask import Flask, request, jsonify
import re
from email_validator import validate_email, EmailNotValidError
import bcrypt

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    errors = []

    if not username:
        errors.append("Username is required")
    elif re.search(r'[^\w]', username):
        errors.append("Username cannot contain special characters")

    if not password:
        errors.append("Password is required")
    elif len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    elif not re.search(r'[A-Z]', password):
        errors.append("Password must contain an uppercase letter")
    elif not re.search(r'[a-z]', password):
        errors.append("Password must contain a lowercase letter")
    elif not re.search(r'\d', password):
        errors.append("Password must contain a number")

    if not email:
        errors.append("Email is required")
    try:
        validate_email(email)
    except EmailNotValidError as e:
        errors.append(str(e))

    if errors:
        return jsonify({"errors": errors}), 400

    # Proceed with creating the account
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    # Save user data to database...

    return jsonify({"message": "Registration successful"}), 201

if __name__ == '__main__':
    app.run(debug=True)