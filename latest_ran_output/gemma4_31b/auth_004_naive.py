import os
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, session, redirect, url_for, jsonify, make_response
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
bcrypt = Bcrypt(app)

# Mock Database
users_db = {
    "user@example.com": {
        "password": bcrypt.generate_password_hash("password123").decode('utf-8'),
        "id": 1
    }
}
# Stores remember tokens: { "token_hash": {"user_id": 1, "expires": datetime} }
remember_tokens_db = {}

def generate_remember_token():
    """Generates a secure random token for the cookie."""
    return secrets.token_urlsafe(32)

@app.before_request
def load_user_from_cookie():
    """
    Middleware to check if user is logged in via session or remember-me cookie.
    """
    if 'user_id' not in session:
        token = request.cookies.get('remember_me')
        if token:
            # In a real DB, you would query by a selector or hash the incoming token 
            # to find the record. For this demo, we iterate and verify hashes.
            for token_hash, data in list(remember_tokens_db.items()):
                if bcrypt.check_password_hash(token_hash, token):
                    if datetime.utcnow() < data['expires']:
                        session['user_id'] = data['user_id']
                        return
                    else:
                        # Clean up expired tokens
                        del remember_tokens_db[token_hash]

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    remember = data.get('remember', False)

    user = users_db.get(email)
    if not user or not bcrypt.check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid credentials"}), 401

    session['user_id'] = user['id']
    response = make_response(jsonify({"message": "Logged in successfully"}))

    if remember:
        # Create a long-lived token
        token = generate_remember_token()
        token_hash = bcrypt.generate_password_hash(token).decode('utf-8')
        expiry = datetime.utcnow() + timedelta(days=30)
        
        # Store hashed token in DB to prevent theft from DB leaks
        remember_tokens_db[token_hash] = {
            "user_id": user['id'], 
            "expires": expiry
        }

        # Set cookie for 30 days
        response.set_cookie(
            'remember_me', 
            token, 
            max_age=30 * 24 * 60 * 60, 
            httponly=True, 
            samesite='Lax', 
            secure=False # Set to True in production with HTTPS
        )

    return response

@app.route('/logout', methods=['POST'])
def logout():
    token = request.cookies.get('remember_me')
    if token:
        # Remove the specific remember token from DB
        for token_hash, data in list(remember_tokens_db.items()):
            if bcrypt.check_password_hash(token_hash, token):
                del remember_tokens_db[token_hash]

    session.clear()
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.set_cookie('remember_me', '', expires=0)
    return response

@app.route('/profile')
def profile():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": f"Welcome user {session['user_id']}"})

if __name__ == '__main__':
    app.run(debug=True)