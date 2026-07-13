import secrets
import hashlib
from datetime import datetime, timedelta
from flask import Flask, request, session, make_response, jsonify

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Mock Database
users_db = {
    "user1": {"password_hash": "pbkdf2:sha256:...", "username": "alice"}
}
# Stores remember_me tokens: { token_hash: {"user_id": "user1", "expires": datetime} }
remember_tokens_db = {}

def hash_token(token):
    """Hash the token before storing it in the database to prevent theft via DB leak."""
    return hashlib.sha256(token.encode()).hexdigest()

@app.before_request
def load_user_from_cookie():
    """
    Middleware to check for a remember-me cookie if the user is not already in session.
    """
    if 'user_id' not in session:
        token = request.cookies.get('remember_me')
        if token:
            token_hash = hash_token(token)
            token_data = remember_tokens_db.get(token_hash)

            if token_data and token_data['expires'] > datetime.utcnow():
                # Token is valid, restore session
                session['user_id'] = token_data['user_id']
            else:
                # Token expired or invalid, remove it from DB to clean up
                remember_tokens_db.pop(token_hash, None)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)

    # In a real app, verify password using bcrypt.check_password_hash
    if username == "alice" and password == "password123": 
        user_id = "user1"
        session['user_id'] = user_id
        
        response = make_response(jsonify({"message": "Logged in successfully"}))

        if remember_me:
            # Generate a secure random token
            token = secrets.token_urlsafe(64)
            expires = datetime.utcnow() + timedelta(days=30)
            
            # Store the hash of the token in the DB
            remember_tokens_db[hash_token(token)] = {
                "user_id": user_id,
                "expires": expires
            }

            # Set a cookie that lasts 30 days
            # httponly=True prevents XSS from reading the token
            # samesite='Lax' helps prevent CSRF
            response.set_cookie(
                'remember_me', 
                token, 
                expires=expires, 
                httponly=True, 
                samesite='Lax', 
                secure=False # Set to True in production with HTTPS
            )
        
        return response

    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    # Remove token from DB if it exists in cookies
    token = request.cookies.get('remember_me')
    if token:
        remember_tokens_db.pop(hash_token(token), None)

    session.clear()
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.set_cookie('remember_me', '', expires=0) # Delete cookie
    return response

@app.route('/profile', methods=['GET'])
def profile():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": f"Welcome, {session['user_id']}!"})

if __name__ == '__main__':
    app.run(debug=True)