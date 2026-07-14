from flask import Flask, request, jsonify
from email_validator import validate_email, EmailNotValidError
import bcrypt
import re

app = Flask(__name__)

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    
    # Validate email format
    try:
        valid = validate_email(data['email'])
        email = valid.email
    except EmailNotValidError as e:
        return jsonify({'error': 'Invalid email address'}), 400
    
    # Enforce password complexity rules
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
    if not re.search(r'[a-z]', data['password']):
        return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400
    if not re.search(r'[A-Z]', data['password']):
        return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400
    if not re.search(r'\d', data['password']):
        return jsonify({'error': 'Password must contain at least one digit'}), 400
    
    # Reject usernames with special characters
    if not re.match(r'^[a-zA-Z0-9]+$', data['username']):
        return jsonify({'error': 'Username can only contain letters and numbers'}), 400
    
    # Hash password before storing
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    # Store user in database (not shown here)
    
    return jsonify({'message': 'Registration successful'}), 201

if __name__ == '__main__':
    app.run(debug=True)