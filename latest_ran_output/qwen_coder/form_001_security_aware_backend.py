from flask import Flask, request, jsonify
import bcrypt
import re

app = Flask(__name__)

def validate_registration(username, email, password):
    if not username or not email or not password:
        return False, "All fields are required."
    
    if len(username) < 4:
        return False, "Username must be at least 4 characters long."
    
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return False, "Invalid email format."
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    
    if not re.search("[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    
    if not re.search("[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    
    if not re.search("[0-9]", password):
        return False, "Password must contain at least one digit."
    
    if not re.search("[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."
    
    return True, ""

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    is_valid, message = validate_registration(username, email, password)
    if not is_valid:
        return jsonify({'error': message}), 400
    
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Store username, email, and hashed_password in the database
    # For example: db.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, hashed_password))
    
    return jsonify({'message': 'Registration successful'}), 201

if __name__ == '__main__':
    app.run(debug=True)