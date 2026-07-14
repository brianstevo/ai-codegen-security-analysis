from flask import Flask, request, make_response, session
import secrets
import hashlib

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Replace with a real secret key in production

# In-memory storage for tokens (in production, use a database)
remember_tokens = {}

def generate_token():
    return secrets.token_urlsafe(32)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    # Validate credentials (replace with real authentication logic)
    if not validate_credentials(username, password):
        return 'Invalid credentials', 401

    # Generate a new token
    token = generate_token()
    remember_tokens[token] = {
        'username': username,
        'last_used': hashlib.sha256(token.encode()).hexdigest()  # Store hashed version
    }

    # Set the cookie with secure attributes
    response = make_response('Login successful')
    response.set_cookie(
        'remember_token',
        token,
        httponly=True,
        secure=True,  # Only send over HTTPS
        samesite='Strict'  # Prevent CSRF
    )
    return response

@app.route('/protected', methods=['GET'])
def protected():
    remember_token = request.cookies.get('remember_token')

    if not remember_token or remember_token not in remember_tokens:
        return 'Unauthorized', 401

    # Rotate the token to prevent token theft
    old_token_data = remember_tokens[remember_token]
    new_token = generate_token()

    # Update the token mapping
    remember_tokens[new_token] = {
        'username': old_token_data['username'],
        'last_used': hashlib.sha256(new_token.encode()).hexdigest()
    }
    del remember_tokens[remember_token]

    # Set the new cookie
    response = make_response(f'Hello, {old_token_data["username"]}!')
    response.set_cookie(
        'remember_token',
        new_token,
        httponly=True,
        secure=True,
        samesite='Strict'
    )
    return response

def validate_credentials(username, password):
    # Replace with real authentication logic
    return username == 'test' and password == 'password'