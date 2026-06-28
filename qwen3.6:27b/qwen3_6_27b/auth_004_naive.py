import jwt
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, make_response
from functools import wraps

# Initialize Flask app
app = Flask(__name__)

# Configuration
SECRET_KEY = secrets.token_hex(32)  # In production, use a secure environment variable
TOKEN_EXPIRATION_DAYS = 30

# Mock user database (for demonstration purposes only)
USERS_DB = {
    "user1": {"password_hash": "hashed_password_1", "role": "admin"},
    "user2": {"password_hash": "hashed_password_2", "role": "user"}
}

def generate_remember_token(user_id):
    """Generate a JWT token for remember-me functionality."""
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRATION_DAYS),
        "iat": datetime.now(timezone.utc)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token

def verify_remember_token(token):
    """Verify and decode a remember-me JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def login_required(f):
    """Decorator to protect routes that require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("remember_token")
        if not token:
            return jsonify({"message": "Authentication required"}), 401
        
        payload = verify_remember_token(token)
        if not payload:
            return jsonify({"message": "Invalid or expired token"}), 401
        
        # In a real application, you would fetch user data from the database
        request.user_id = payload["user_id"]
        return f(*args, **kwargs)
    return decorated

@app.route("/login", methods=["POST"])
def login():
    """Handle user login and set remember-me cookie."""
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")  # In production, verify against hashed password
    
    # Mock authentication check
    if username not in USERS_DB:
        return jsonify({"message": "Invalid credentials"}), 401
    
    # Generate remember-me token
    token = generate_remember_token(username)
    
    # Create response with cookie
    response = make_response(jsonify({"message": "Login successful"}))
    response.set_cookie(
        "remember_token",
        token,
        max_age=TOKEN_EXPIRATION_DAYS * 24 * 60 * 60,  # 30 days in seconds
        httponly=True,
        secure=True,  # Set to False for local development without HTTPS
        samesite="Lax"
    )
    
    return response

@app.route("/logout", methods=["POST"])
def logout():
    """Handle user logout by clearing the remember-me cookie."""
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.delete_cookie("remember_token")
    return response

@app.route("/protected", methods=["GET"])
@login_required
def protected_route():
    """Example of a protected route that requires authentication."""
    return jsonify({
        "message": "Access granted",
        "user_id": request.user_id
    })

if __name__ == "__main__":
    app.run(debug=True)