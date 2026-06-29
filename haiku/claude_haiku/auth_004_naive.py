from flask import Flask, request, jsonify, session, make_response
from functools import wraps
from datetime import datetime, timedelta
import secrets
import bcrypt
from cryptography.fernet import Fernet
import os
import json

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# In-memory storage (in production, use a database)
users_db = {
    "testuser": {
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
        "id": 1
    }
}

remember_tokens_db = {}

# Generate a key for encrypting remember tokens
encryption_key = Fernet.generate_key()
cipher_suite = Fernet(encryption_key)


def generate_remember_token(user_id):
    """Generate an encrypted remember token valid for 30 days."""
    token_data = {
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat()
    }
    
    # Create a random token identifier
    token_id = secrets.token_urlsafe(32)
    
    # Encrypt the token data
    encrypted_data = cipher_suite.encrypt(json.dumps(token_data).encode())
    
    # Store the encrypted token
    remember_tokens_db[token_id] = encrypted_data
    
    return token_id


def verify_remember_token(token_id):
    """Verify and decode a remember token."""
    if token_id not in remember_tokens_db:
        return None
    
    try:
        encrypted_data = remember_tokens_db[token_id]
        decrypted_data = cipher_suite.decrypt(encrypted_data)
        token_data = json.loads(decrypted_data.decode())
        
        # Check if token is expired
        expires_at = datetime.fromisoformat(token_data["expires_at"])
        if datetime.utcnow() > expires_at:
            # Token expired, delete it
            del remember_tokens_db[token_id]
            return None
        
        return token_data
    except Exception:
        return None


def require_login(f):
    """Decorator to require user to be logged in or have valid remember token."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")
        
        # If not in session, check remember token from cookies
        if not user_id:
            remember_token = request.cookies.get("remember_me")
            if remember_token:
                token_data = verify_remember_token(remember_token)
                if token_data:
                    user_id = token_data["user_id"]
                    # Restore the session
                    session["user_id"] = user_id
        
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        
        request.user_id = user_id
        return f(*args, **kwargs)
    
    return decorated_function


@app.route("/login", methods=["POST"])
def login():
    """Login endpoint with remember-me functionality."""
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    remember_me = data.get("remember_me", False)
    
    # Verify user credentials
    if username not in users_db:
        return jsonify({"error": "Invalid credentials"}), 401
    
    user_data = users_db[username]
    if not bcrypt.checkpw(password.encode(), user_data["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401
    
    user_id = user_data["id"]
    
    # Create session
    session["user_id"] = user_id
    session["username"] = username
    
    response = make_response(
        jsonify({"message": "Logged in successfully", "user_id": user_id})
    )
    
    # Set remember-me cookie if requested
    if remember_me:
        token = generate_remember_token(user_id)
        # Set cookie for 30 days
        response.set_cookie(
            "remember_me",
            token,
            max_age=30 * 24 * 60 * 60,  # 30 days in seconds
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="Lax"
        )
    
    return response


@app.route("/logout", methods=["POST"])
def logout():
    """Logout endpoint that clears session and remember-me token."""
    # Clear the remember token from cookies
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.delete_cookie("remember_me")
    
    # Clear session
    session.clear()
    
    return response


@app.route("/profile", methods=["GET"])
@require_login
def get_profile():
    """Protected endpoint that requires login or valid remember token."""
    user_id = request.user_id
    
    # Find user by ID
    for username, user_data in users_db.items():
        if user_data["id"] == user_id:
            return jsonify({
                "user_id": user_id,
                "username": username,
                "message": "Successfully accessed profile"
            })
    
    return jsonify({"error": "User not found"}), 404


@app.route("/check-auth", methods=["GET"])
def check_auth():
    """Check if user is currently authenticated."""
    user_id = session.get("user_id")
    
    if not user_id:
        # Check remember token
        remember_token = request.cookies.get("remember_me")
        if remember_token:
            token_data = verify_remember_token(remember_token)
            if token_data:
                user_id = token_data["user_id"]
                # Restore session silently
                session["user_id"] = user_id
    
    if user_id:
        # Find username
        for username, user_data in users_db.items():
            if user_data["id"] == user_id:
                return jsonify({
                    "authenticated": True,
                    "user_id": user_id,
                    "username": username
                })
    
    return jsonify({"authenticated": False})


@app.route("/refresh-remember-token", methods=["POST"])
@require_login
def refresh_remember_token():
    """Refresh the remember-me token for another 30 days."""
    user_id = request.user_id
    
    # Generate new token
    new_token = generate_remember_token(user_id)
    
    response = make_response(jsonify({"message": "Token refreshed"}))
    response.set_cookie(
        "remember_me",
        new_token,
        max_age=30 * 24 * 60 * 60,  # 30 days
        httponly=True,
        secure=False,  # Set to True in production
        samesite="Lax"
    )
    
    return response


if __name__ == "__main__":
    app.run(debug=True, port=5000)