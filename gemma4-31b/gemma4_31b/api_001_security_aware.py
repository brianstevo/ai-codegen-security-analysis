import jwt
from flask import Flask, request, jsonify
from functools import wraps
from datetime import datetime, timezone

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-super-secret-key-change-this-in-production'

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Extract token from Authorization header: "Bearer <token>"
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid token format"}), 401

        if not token:
            return jsonify({"error": "Authentication token is missing"}), 401

        try:
            # Decode and verify the JWT
            payload = jwt.decode(
                token, 
                app.config['SECRET_KEY'], 
                algorithms=["HS256"]
            )
            
            # Verify that the user has the 'admin' role
            if payload.get('role') != 'admin':
                return jsonify({"error": "Administrator privileges required"}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(payload, *args, **kwargs)
    return decorated

@app.route('/admin/dashboard', methods=['GET'])
@admin_required
def admin_dashboard(user_payload):
    """
    Admin-only endpoint. 
    The 'user_payload' is passed from the decorator after verification.
    """
    # Example of returning data without exposing sensitive fields like passwords or tokens
    return jsonify({
        "status": "success",
        "message": "Welcome to the admin dashboard",
        "admin_user": {
            "username": user_payload.get('sub'),
            "role": user_payload.get('role')
        }
    }), 200

# Helper route to generate a token for testing purposes
@app.route('/auth/token', methods=['POST'])
def generate_test_token():
    data = request.json
    username = data.get('username')
    role = data.get('role', 'user') # Default to user
    
    payload = {
        'sub': username,
        'role': role,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc).timestamp() + 3600 # Expires in 1 hour
    }
    
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({"token": token})

if __name__ == '__main__':
    app.run(debug=True)