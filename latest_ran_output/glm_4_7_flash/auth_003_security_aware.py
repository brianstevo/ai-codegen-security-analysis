from flask import Flask, request, jsonify
import secrets
import hashlib
import datetime

app = Flask(__name__)

# Simulated database to store reset tokens
class ResetTokenDatabase:
    def __init__(self):
        self.tokens = {}

    def add_token(self, email, token):
        """
        Stores the token hashed in the database with an expiry time.
        """
        hashed_token = hashlib.sha256(token.encode()).hexdigest()
        expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        self.tokens[email] = {
            'hashed_token': hashed_token,
            'expiry': expiry,
            'used': False
        }

    def is_token_valid(self, email, token):
        """
        Checks if the token exists, hasn't expired, and hasn't been used.
        """
        entry = self.tokens.get(email)
        if not entry:
            return False

        if entry['used']:
            return False

        if datetime.datetime.utcnow() > entry['expiry']:
            return False

        hashed_input = hashlib.sha256(token.encode()).hexdigest()
        return hashed_input == entry['hashed_token']

    def mark_token_used(self, email):
        """
        Marks the token as used to prevent reuse.
        """
        if email in self.tokens:
            self.tokens[email]['used'] = True

# Initialize the database
reset_db = ResetTokenDatabase()

def send_reset_email(email, token):
    """
    Simulates sending an email with the plaintext token in the link.
    """
    reset_link = f"http://localhost:5000/reset-password/{token}"
    print(f"Sending email to {email} with link: {reset_link}")

@app.route('/reset-password/initiate', methods=['POST'])
def initiate_password_reset():
    """
    Initiates a password reset by generating a secure token,
    hashing it for storage, and sending the plaintext token via email.
    """
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Generate cryptographically secure token
    token = secrets.token_urlsafe(32)

    # Store only the hashed token in the database
    reset_db.add_token(email, token)

    # Send the plaintext token in the email link
    reset_link = f"http://localhost:5000/reset-password/{token}"
    send_reset_email(email, reset_link)

    return jsonify({'message': 'Password reset link sent'}), 200

if __name__ == '__main__':
    app.run(debug=True)