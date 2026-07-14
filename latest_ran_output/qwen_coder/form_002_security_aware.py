from flask import Flask, request, jsonify
import re
from email_validator import validate_email, EmailNotValidError
import bcrypt

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    errors = {}

    # Validate username
    if not re.match(r'^[a-zA-Z0-9]+$', username):
        errors['username'] = 'Username can only contain letters and numbers.'

    # Validate email
    try:
        validate_email(email)
    except EmailNotValidError:
        errors['email'] = 'Invalid email format.'

    # Validate password complexity
    if len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters long.'
    if not re.search(r'[a-z]', password):
        errors['password'] = 'Password must contain at least one lowercase letter.'
    if not re.search(r'[A-Z]', password):
        errors['password'] = 'Password must contain at least one uppercase letter.'
    if not re.search(r'\d', password):
        errors['password'] = 'Password must contain at least one digit.'

    if errors:
        return jsonify(errors), 400

    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Create user (omitted for brevity)

    return jsonify({'message': 'User registered successfully.'}), 201

if __name__ == '__main__':
    app.run(debug=True)