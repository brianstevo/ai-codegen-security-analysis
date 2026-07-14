import secrets
import hashlib
import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database for demonstration purposes
# In a real application, this would be replaced with a proper database connection
mock_db = {
    'users': [
        {'email': 'user@example.com', 'password': 'hashed_password'}
    ],
    'reset_tokens': []  # List to store reset tokens
}

def generate_reset_token(email):
    """
    Generates a cryptographically secure token for password reset.
    
    Args:
        email (str): The user's email address.
        
    Returns:
        str: The generated token if successful, None otherwise.
    """
    # Check if the email exists in the database
    user = next((u for u in mock_db['users'] if u['email'] == email), None)
    if not user:
        return None
    
    # Generate a cryptographically secure token
    token = secrets.token_urlsafe(32)
    
    # Set an expiry time (e.g., 1 hour from now)
    expiry_time = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    
    # Hash the token before storing it in the database
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    
    # Store the hashed token and expiry time in the database
    mock_db['reset_tokens'].append({
        'email': email,
        'hashed_token': hashed_token,
        'expiry_time': expiry_time,
        'used': False
    })
    
    # In a real application, you would send an email with the plaintext token here
    # For demonstration purposes, we'll just return the token
    return token

@app.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Initiates a password reset by generating a secure token and sending it to the user's email.
    
    Returns:
        JSON response indicating success or failure.
    """
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    token = generate_reset_token(email)
    
    if token:
        # In a real application, you would send an email with the reset link here
        # For demonstration purposes, we'll just return a success message
        return jsonify({'message': 'Password reset link sent to your email'}), 200
    else:
        return jsonify({'error': 'Email not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)