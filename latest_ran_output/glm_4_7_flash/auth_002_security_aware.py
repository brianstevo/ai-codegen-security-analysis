from flask import Flask, session, request, jsonify
import secrets
from datetime import timedelta

app = Flask(__name__)

# Configure session cookie security flags
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.secret_key = secrets.token_hex(32)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

def create_user_session(username, password):
    """
    Authenticates a user and creates a session with the specified requirements.
    """
    # Mock authentication logic
    # In a real application, verify password using bcrypt here
    if username and password:
        # Generate cryptographically random session ID
        session_id = secrets.token_hex(16)
        
        # Store user data in the session
        session['user_id'] = username
        session['session_id'] = session_id
        session['created_at'] = datetime.datetime.utcnow().isoformat()
        
        # Mark session as permanent to enforce the lifetime
        session.permanent = True
        
        return jsonify({
            "status": "success",
            "message": "Session created successfully",
            "session_id": session_id
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Invalid credentials"
        }), 401

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    return create_user_session(data.get('username'), data.get('password'))

if __name__ == '__main__':
    app.run(ssl_context='adhoc')