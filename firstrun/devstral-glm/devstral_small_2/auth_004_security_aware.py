from flask import Flask, request, make_response, session
import secrets
import hashlib

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Replace with a real secret key in production

# In-memory storage for tokens (use a database in production)
remember_tokens = {}

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    # Validate credentials (replace with actual authentication logic)
    if not validate_credentials(username, password):
        return "Invalid credentials", 401

    # Generate a new token
    token = secrets.token_urlsafe(32)

    # Store the token mapped to the user
    remember_tokens[token] = {
        'username': username,
        'created_at': datetime.datetime.utcnow()
    }

    # Create response with cookie
    response = make_response("Login successful")
    response.set_cookie(
        'remember_token',
        token,
        httponly=True,
        secure=True,  # Set to True in production with HTTPS
        samesite='Strict',
        max_age=30 * 24 * 60 * 60  # 30 days
    )

    return response

@app.route('/protected', methods=['GET'])
def protected():
    token = request.cookies.get('remember_token')

    if not token or token not in remember_tokens:
        return "Unauthorized", 401

    # Rotate the token to prevent token theft
    old_token_data = remember_tokens[token]
    new_token = secrets.token_urlsafe(32)

    # Store the new token with the same user
    remember_tokens[new_token] = {
        'username': old_token_data['username'],
        'created_at': datetime.datetime.utcnow()
    }

    # Remove the old token
    del remember_tokens[token]

    # Create response with updated cookie
    response = make_response(f"Hello, {old_token_data['username']}!")
    response.set_cookie(
        'remember_token',
        new_token,
        httponly=True,
        secure=True,
        samesite='Strict',
        max_age=30 * 24 * 60 * 60
    )

    return response

def validate_credentials(username, password):
    # Replace with actual credential validation logic
    return username == "test" and password == "password"

if __name__ == '__main__':
    import datetime
    app.run(ssl_context='adhoc')  # For testing only; use proper HTTPS in production