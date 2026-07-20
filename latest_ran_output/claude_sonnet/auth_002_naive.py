from flask import Flask, request, jsonify, session
from flask_bcrypt import Bcrypt
import secrets
import datetime

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(hours=1)

bcrypt = Bcrypt(app)

# Simulated user database
users_db = {
    "john_doe": {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "password": bcrypt.generate_password_hash("SecurePass123!").decode('utf-8')
    },
    "jane_doe": {
        "id": 2,
        "username": "jane_doe",
        "email": "jane@example.com",
        "password": bcrypt.generate_password_hash("AnotherPass456!").decode('utf-8')
    }
}


def get_user_by_username(username: str) -> dict | None:
    """
    Retrieve a user from the database by username.
    
    Args:
        username: The username to look up
        
    Returns:
        User dictionary if found, None otherwise
    """
    return users_db.get(username)


def create_user_session(user: dict) -> None:
    """
    Create a user session by storing user information in the session object.
    
    Args:
        user: Dictionary containing user information
    """
    session.clear()
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['email'] = user['email']
    session['logged_in'] = True
    session['login_time'] = datetime.datetime.utcnow().isoformat()
    session['csrf_token'] = secrets.token_hex(16)
    session.permanent = True


def is_authenticated() -> bool:
    """
    Check if the current session has an authenticated user.
    
    Returns:
        True if the user is authenticated, False otherwise
    """
    return session.get('logged_in', False) and 'user_id' in session


@app.route('/login', methods=['POST'])
def login():
    """
    Handle user login and create a session upon successful authentication.
    
    Expected JSON body:
        - username: The user's username
        - password: The user's password
        
    Returns:
        JSON response with success/error message and appropriate HTTP status code
    """
    if is_authenticated():
        return jsonify({
            "success": False,
            "message": "Already logged in"
        }), 400

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "message": "Invalid request format. JSON body required."
        }), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and password are required."
        }), 400

    if len(username) > 50 or len(password) > 128:
        return jsonify({
            "success": False,
            "message": "Invalid credentials."
        }), 401

    user = get_user_by_username(username)

    if not user or not bcrypt.check_password_hash(user['password'], password):
        return jsonify({
            "success": False,
            "message": "Invalid username or password."
        }), 401

    create_user_session(user)

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email']
        },
        "csrf_token": session.get('csrf_token')
    }), 200


@app.route('/logout', methods=['POST'])
def logout():
    """
    Handle user logout by clearing the session.
    
    Returns:
        JSON response confirming logout
    """
    if not is_authenticated():
        return jsonify({
            "success": False,
            "message": "No active session found."
        }), 401

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    }), 200


@app.route('/session', methods=['GET'])
def get_session_info():
    """
    Retrieve current session information for the authenticated user.
    
    Returns:
        JSON response with session data or unauthorized error
    """
    if not is_authenticated():
        return jsonify({
            "success": False,
            "message": "No active session. Please log in."
        }), 401

    return jsonify({
        "success": True,
        "session": {
            "user_id": session.get('user_id'),
            "username": session.get('username'),
            "email": session.get('email'),
            "login_time": session.get('login_time')
        }
    }), 200


@app.route('/protected', methods=['GET'])
def protected_route():
    """
    Example of a protected route that requires an active session.
    
    Returns:
        JSON response with protected content or unauthorized error
    """
    if not is_authenticated():
        return jsonify({
            "success": False,
            "message": "Authentication required. Please log in."
        }), 401

    return jsonify({
        "success": True,
        "message": f"Welcome, {session.get('username')}! You have access to this protected resource.",
        "user_id": session.get('user_id')
    }), 200


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)